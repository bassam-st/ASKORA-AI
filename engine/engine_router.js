// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";
import { smartSummarize } from "../answer/smart_summarizer.js";
import { classifyIntent } from "../intent/intent_classifier.js";

export async function routeEngine({ text, intent, context }) {
  const question = String(text || "").trim();
  const safeIntent = String(intent || "").trim();
  const safeContext = String(context || "").trim();

  if (!question) {
    return buildAnswer({
      question: "",
      intent: safeIntent,
      context: safeContext,
      final: "السؤال فارغ.",
      sources: [],
      note: "تم رفض الطلب لأن السؤال فارغ.",
      actions: [],
    });
  }

  const auto = classifyIntent({ text: question, context: safeContext });
  const finalIntent = safeIntent || (auto?.intent || "general");
  const confidence = Number(auto?.confidence || 0.5);

  // ✅ Actions جاهزة حسب النية
  const actions = buildActions({ question, intent: finalIntent, confidence });

  // 1) الذاكرة الطويلة أولاً
  try {
    const mem = await searchLongTerm(question);
    if (mem?.answer) {
      return buildAnswer({
        question,
        intent: finalIntent,
        context: safeContext,
        final: String(mem.answer),
        sources: [{ title: "Long-term memory", content: String(mem.answer), link: "" }],
        note: "تمت الإجابة من الذاكرة الطويلة.",
        actions,
      });
    }
  } catch {}

  // 2) بحث الويب
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(question, { num: finalIntent === "schedule" ? 8 : 6 });
  } catch {
    sourcesRaw = [];
  }

  const sources = normalizeSources(sourcesRaw);

  // 3) محاولة Gemini
  let llm = null;
  try {
    llm = await askoraLLM({
      question,
      intent: finalIntent,
      context: safeContext,
      sources,
    });
  } catch (e) {
    llm = { ok: false, text: "", error: cleanErr(e) };
  }

  // 4) نص النهائي
  let finalText = "";
  let note = "";

  if (llm?.ok && String(llm.text || "").trim()) {
    finalText = String(llm.text).trim();
    note = "تم توليد الإجابة عبر Gemini.";
  } else {
    finalText = smartSummarize({
      question,
      intent: finalIntent,
      sources,
    });

    note = llm?.error
      ? "تعذر تشغيل Gemini حالياً. تم استخدام تلخيص ذكي من نتائج البحث."
      : "تم استخدام تلخيص ذكي من نتائج البحث.";
  }

  return buildAnswer({
    question,
    intent: finalIntent,
    context: safeContext,
    final: finalText,
    sources,
    note,
    actions,
  });
}

// ✅ يبني Actions حسب النية (هذا قلب مستوى B)
function buildActions({ question = "", intent = "general", confidence = 0.5 } = {}) {
  const q = String(question || "").toLowerCase();

  // مباريات اليوم
  if (intent === "schedule") {
    // روابط موثوقة وسريعة
    const yalla = "https://www.yallakora.com/match-center";
    const filgoal = "https://www.filgoal.com/matches";
    const kooora = "https://www.kooora.com/";

    // لو المستخدم كتب فريق: نفتح بحث داخل يلا كورة
    // (حل بسيط وسريع بدل parsing معقد)
    const teamHint =
      q.includes("الهلال") || q.includes("النصر") || q.includes("الاتحاد") || q.includes("برشلونة") || q.includes("ريال")
        ? `https://www.yallakora.com/search?query=${encodeURIComponent(question)}`
        : "";

    const out = [
      { type: "open_url", label: "⚽ فتح مباريات اليوم (يلا كورة)", url: yalla, primary: true },
      { type: "open_url", label: "📊 مباريات اليوم (FilGoal)", url: filgoal, primary: false },
      { type: "open_url", label: "📰 كرة (Kooora)", url: kooora, primary: false },
    ];

    if (teamHint) {
      out.unshift({ type: "open_url", label: "🔎 بحث عن فريق/مباراة في يلا كورة", url: teamHint, primary: true });
    }

    // لو الثقة عالية نسمح للواجهة تفتح تلقائيًا
    out.forEach((a) => (a.autofire = confidence >= 0.75 && !!a.primary));
    return out;
  }

  return [];
}

/**
 * يوحّد شكل المصادر:
 * { title: string, content: string, link: string }
 */
function normalizeSources(input) {
  const arr = Array.isArray(input)
    ? input
    : (input && Array.isArray(input.sources) ? input.sources : []);

  const badDomains = [
    "facebook.com",
    "m.facebook.com",
    "x.com",
    "twitter.com",
    "tiktok.com",
    "instagram.com",
  ];

  const cleaned = arr
    .filter(Boolean)
    .map((s) => {
      if (typeof s === "string") return { title: "", content: s, link: "" };

      if (typeof s === "object" && s) {
        const title = String(s.title || s.name || "").trim();
        const content = String(s.content || s.snippet || s.text || "").trim();
        const link = String(s.link || s.url || "").trim();
        return { title, content, link };
      }

      return { title: "", content: String(s), link: "" };
    })
    .filter((s) => {
      if (!s.link) return true;
      const u = s.link.toLowerCase();
      return !badDomains.some((d) => u.includes(d));
    })
    .map((s) => ({
      title: clip(s.title, 120),
      content: clip(cleanSnippet(s.content), 420),
      link: clip(s.link, 500),
    }))
    .slice(0, 10);

  return cleaned;
}

function cleanSnippet(s = "") {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\uFFFD/g, "")
    .trim();
}

function clip(s = "", max = 200) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function cleanErr(e) {
  const msg = String(e?.message || e || "").trim();
  return msg.length > 180 ? msg.slice(0, 180) + "…" : msg;
}
