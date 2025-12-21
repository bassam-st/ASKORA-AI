// engine/engine_router.js — V15
// هدف V15: "إجابة مرتبة كنموذج" + فتح أفضل مصدر + لا يتعطل لو LLM غير متوفر

import { webSearch } from "../tools/web_search.js";
import { classifyIntent } from "../intent/intent_classifier.js";
import { smartSummarize } from "../answer/smart_summarizer.js";
import { evaluateConfidence } from "../answer/confidence_evaluator.js";
import { getCache, setCache } from "../memory/cache.js";
import { askoraLLM } from "../llm/askora_llm.js";

export async function routeEngine({ text, text_normalized, context, intent } = {}) {
  const question = String(text || "").trim();
  const qNorm = String(text_normalized || question || "").trim();
  const ctx = String(context || "").trim();

  if (!question) {
    return { ok: true, answer: "السؤال فارغ.", sources: [], note: "empty", intent: "general", confidence: "low" };
  }

  // 1) Intent
  const auto = classifyIntent({ text: qNorm, context: ctx });
  const finalIntent = String(intent || "").trim() || String(auto?.intent || "general");
  const intentConfidence = Number(auto?.confidence || 0.55);

  // 2) Cache
  const cacheKey = `V15::${finalIntent}::${qNorm}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return { ok: true, ...cached, note: (cached.note ? cached.note + " " : "") + "⚡ من الكاش." };
  }

  // 3) Query shaping
  const query = buildQuery(qNorm, finalIntent);

  // 4) Web Search
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(query, { num: 8, intent: finalIntent });
  } catch {
    sourcesRaw = [];
  }

  const sources = rankAndCleanSources(sourcesRaw, finalIntent);

  // 5) Confidence
  const conf = evaluateConfidence({ intent: finalIntent, intentConfidence, question: qNorm, sources });

  // 6) Optional LLM (إذا موجود مفاتيح)
  let llmText = "";
  let llmUsed = false;

  try {
    const llm = await askoraLLM({
      question,
      intent: finalIntent,
      context: ctx,
      sources,
      confidence: conf,
    });
    if (llm?.ok && String(llm.text || "").trim()) {
      llmText = String(llm.text).trim();
      llmUsed = true;
    }
  } catch {
    // ignore
  }

  // 7) Always produce a clean model-like answer
  const finalText = llmUsed
    ? llmText
    : smartSummarize({
        question,
        intent: finalIntent,
        sources,
      });

  const note = llmUsed
    ? "✅ تم توليد الإجابة بواسطة LLM + مصادر."
    : (sources.length ? "✅ تم توليد ملخص مرتب من نتائج البحث." : "⚠️ لا توجد نتائج بحث — تحقق من Google CSE.");

  const out = {
    ok: true,
    answer: finalText,
    sources,
    note,
    intent: finalIntent,
    confidence: conf?.level || "medium",
  };

  // 10 دقائق TTL
  setCache(cacheKey, out, 10 * 60 * 1000);
  return out;
}

function buildQuery(q, intent) {
  const text = String(q || "").trim();
  if (!text) return text;

  if (intent === "schedule") {
    // 🔥 الأفضل لمركز مباريات اليوم
    // يضمن يرجّع صفحات match-center بسرعة
    return "مباريات اليوم yallakora match center";
  }

  if (intent === "news") return text + " آخر الأخبار";
  return text;
}

function rankAndCleanSources(input, intent) {
  const arr = Array.isArray(input) ? input : [];
  const bad = ["facebook.com","m.facebook.com","x.com","twitter.com","tiktok.com","instagram.com","pinterest.com","threads.net"];

  const prefer = intent === "schedule"
    ? ["yallakora.com","koora.com","filgoal.com","365scores.com","sofascore.com"]
    : [];

  const out = arr
    .filter(Boolean)
    .map((s) => ({
      title: clip(String(s?.title || ""), 140),
      link: clip(String(s?.link || ""), 700),
      content: clip(cleanSnippet(String(s?.content || "")), 380),
    }))
    .filter(s => s.link && !bad.some(d => s.link.toLowerCase().includes(d)))
    .map(s => ({ ...s, _score: scoreSource(s, prefer) }))
    .sort((a,b) => (b._score||0) - (a._score||0))
    .map(({_score, ...r}) => r);

  // Dedup
  const seen = new Set();
  const dedup = [];
  for (const s of out) {
    if (seen.has(s.link)) continue;
    seen.add(s.link);
    dedup.push(s);
    if (dedup.length >= 8) break;
  }

  // ✅ ضمان رابط ثابت لمباريات اليوم لو intent=schedule ولم نجد yallakora
  if (intent === "schedule") {
    const hasYK = dedup.some(s => (s.link || "").includes("yallakora.com/match-center"));
    if (!hasYK) {
      dedup.unshift({
        title: "مركز المباريات - يلا كورة",
        link: "https://www.yallakora.com/match-center",
        content: "جدول مباريات اليوم والنتائج لحظة بلحظة.",
      });
    }
  }

  return dedup;
}

function scoreSource(s, preferDomains = []) {
  const host = getHost(s?.link || "");
  let score = 0;
  if (s?.title) score += 2;
  if (s?.content) score += 2;

  for (let i = 0; i < preferDomains.length; i++) {
    const d = preferDomains[i];
    if (host === d || host.endsWith("." + d)) score += (20 - i);
  }

  // ثقة عامة
  if (host.endsWith("wikipedia.org")) score += 6;
  if (host.endsWith("britannica.com")) score += 6;
  if (host.endsWith("reuters.com")) score += 7;
  if (host.endsWith("apnews.com")) score += 6;
  if (host.endsWith("bbc.com")) score += 6;

  return score;
}

function getHost(url="") {
  try { return new URL(url).hostname.replace(/^www\./,"").toLowerCase(); }
  catch { return ""; }
}

function cleanSnippet(s="") {
  return String(s || "").replace(/\s+/g, " ").replace(/\uFFFD/g, "").trim();
}

function clip(s="", max=300) {
  const t = String(s || "");
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}
