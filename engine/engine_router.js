// engine/engine_router.js — VINFINITY
// الهدف: يطلع "ملخص كنموذج" حتى لو LLM غير متوفر.
// 1) تنظيف + Intent + تصحيح بسيط
// 2) كاش سريع (TTL) لتسريع الردود
// 3) Web Search + ترتيب مصادر حسب النية
// 4) تلخيص ذكي (بدون نموذج) + اختياري LLM لو موجود

import { webSearch } from "../tools/web_search.js";
import { classifyIntent } from "../intent/intent_classifier.js";
import { smartSummarize } from "../answer/smart_summarizer.js";
import { evaluateConfidence } from "../answer/confidence_evaluator.js";
import { getCache, setCache } from "../memory/cache.js";
import { askoraLLM } from "../llm/askora_llm.js";

export async function routeEngine({ text, text_normalized, context, intent }) {
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

  // 2) Cache (يحفظ حسب السؤال+النية)
  const cacheKey = `${finalIntent}::${qNorm}`;
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      ok: true,
      ...cached,
      note: (cached.note ? cached.note + " " : "") + "⚡ من الكاش (سريع).",
    };
  }

  // 3) Search query shaping
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

  // 6) Optional LLM (لو موجود مفاتيح GEMINI_API_KEY)
  // لو فشل/غير موجود: نكمل تلخيص ذكي.
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

  const finalText = llmUsed
    ? llmText
    : smartSummarize({
        question,
        question_normalized: qNorm,
        intent: finalIntent,
        intentConfidence,
        sources,
        confidence: conf,
      });

  const note = llmUsed
    ? "✅ تم توليد الإجابة بواسطة LLM (اختياري) + مصادر البحث."
    : (sources.length ? "✅ تم توليد ملخص ذكي من نتائج البحث." : "⚠️ لا توجد نتائج بحث — تحقق من مفاتيح Google CSE.");

  const out = {
    ok: true,
    answer: finalText,
    sources,
    note,
    intent: finalIntent,
    confidence: conf.level,
  };

  // 7) Save cache (TTL)
  setCache(cacheKey, out, 60 * 10); // 10 دقائق
  return out;
}

function buildQuery(q, intent) {
  const text = String(q || "").trim();
  if (!text) return text;

  if (intent === "schedule") {
    // هذه أفضل صيغة عشان يجيب مركز المباريات
    return "جدول مباريات اليوم match center يلا كورة";
  }

  if (intent === "news") {
    return text + " آخر الأخبار";
  }

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

  // Dedup by link
  const seen = new Set();
  const dedup = [];
  for (const s of out) {
    if (seen.has(s.link)) continue;
    seen.add(s.link);
    dedup.push(s);
    if (dedup.length >= 8) break;
  }
  return dedup;
}

function scoreSource(s, preferDomains = []) {
  const host = getHost(s?.link || "");
  let score = 0;
  if (s?.title) score += 2;
  if (s?.content) score += 2;

  // Prefer by intent
  for (let i=0;i<preferDomains.length;i++){
    const d = preferDomains[i];
    if (host === d || host.endsWith("." + d)) score += (16 - i);
  }

  // General trust
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
  return String(s||"").replace(/\s+/g," ").replace(/\uFFFD/g,"").trim();
}

function clip(s="", max=300) {
  const t = String(s||"");
  return t.length <= max ? t : t.slice(0, max-1) + "…";
}
