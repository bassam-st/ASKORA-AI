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

  // 0) تحقق
  if (!question) {
    return buildAnswer({
      question: "",
      intent: safeIntent,
      context: safeContext,
      final: "السؤال فارغ.",
      sources: [],
      note: "تم رفض الطلب لأن السؤال فارغ.",
    });
  }

  // 0.1) Intent تلقائي لو مش موجود
  const auto = classifyIntent({ text: question, context: safeContext });
  const finalIntent = safeIntent || (auto?.intent || "general");

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
      });
    }
  } catch {
    // تجاهل مشاكل الذاكرة
  }

  // 2) بحث الويب (Fallback أساسي) ✅ مع intent
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(question, { num: 6, intent: finalIntent });
  } catch {
    sourcesRaw = [];
  }

  // 2.1) توحيد وتنظيف المصادر
  const sources = normalizeSources(sourcesRaw);

  // 3) محاولة Gemini (قد يفشل بسبب quota)
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

  // 4) النتيجة النهائية
  let finalText = "";
  let note = "";

  if (llm?.ok && String(llm.text || "").trim()) {
    finalText = String(llm.text).trim();
    note = "تم توليد الإجابة عبر Gemini.";
  } else {
    // تلخيص ذكي بدون نموذج
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
  });
}

/**
 * يوحّد شكل المصادر ويضمن أنها Array من:
 * { title: string, content: string, link: string }
 */
function normalizeSources(input) {
  const arr = Array.isArray(input)
    ? input
    : (input && Array.isArray(input.sources) ? input.sources : []);

  // فلتر روابط مزعجة (اختياري)
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
      if (typeof s === "string") {
        return { title: "", content: s, link: "" };
      }

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
    .slice(0, 8);

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
