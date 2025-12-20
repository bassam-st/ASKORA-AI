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
    });
  }

  // Intent تلقائي
  const auto = classifyIntent({ text: question, context: safeContext });
  const finalIntent = safeIntent || (auto?.intent || "general");

  // 1) ذاكرة طويلة
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
    // ignore
  }

  // 2) بحث الويب
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(question, { num: 6 });
  } catch {
    sourcesRaw = [];
  }
  const sources = normalizeSources(sourcesRaw);

  // 3) محاولة Gemini (بدون عرض الأخطاء الطويلة للمستخدم)
  let llmText = "";
  let usedGemini = false;

  try {
    const llm = await askoraLLM({
      question,
      intent: finalIntent,
      context: safeContext,
      sources,
    });

    if (llm?.ok && String(llm.text || "").trim()) {
      llmText = String(llm.text).trim();
      usedGemini = true;
    }
  } catch {
    // لا نمرر الخطأ للواجهة
    usedGemini = false;
  }

  // 4) نتيجة نهائية
  const finalText = usedGemini
    ? llmText
    : smartSummarize({ question, intent: finalIntent, sources });

  const note = usedGemini
    ? "تم توليد الإجابة عبر Gemini."
    : "تم استخدام تلخيص ذكي من نتائج البحث (Gemini غير متاح حالياً).";

  return buildAnswer({
    question,
    intent: finalIntent,
    context: safeContext,
    final: finalText,
    sources,
    note,
  });
}

function normalizeSources(input) {
  const arr = Array.isArray(input)
    ? input
    : (input && Array.isArray(input.sources) ? input.sources : []);

  const cleaned = arr
    .filter(Boolean)
    .map((s) => {
      if (typeof s === "string") return { title: "", content: s, link: "" };
      if (typeof s === "object" && s) {
        return {
          title: String(s.title || s.name || "").trim(),
          content: String(s.content || s.snippet || s.text || "").trim(),
          link: String(s.link || s.url || "").trim(),
        };
      }
      return { title: "", content: String(s), link: "" };
    })
    .map((s) => ({
      title: clip(s.title, 120),
      content: clip(cleanSnippet(s.content), 420),
      link: clip(s.link, 600),
    }))
    .slice(0, 8);

  return cleaned;
}

function cleanSnippet(s = "") {
  return String(s || "").replace(/\s+/g, " ").replace(/\uFFFD/g, "").trim();
}

function clip(s = "", max = 200) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}
