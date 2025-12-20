// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";

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

  // 1) الذاكرة الطويلة أولًا
  try {
    const mem = await searchLongTerm(question);
    if (mem?.answer) {
      return buildAnswer({
        question,
        intent: safeIntent,
        context: safeContext,
        final: String(mem.answer),
        sources: [{ title: "Long-term memory", content: String(mem.answer), link: "" }],
        note: "تمت الإجابة من الذاكرة الطويلة.",
      });
    }
  } catch (e) {
    // تجاهل مشاكل الذاكرة ولا توقف النظام
  }

  // 2) بحث Google (Fallback أساسي)
  let sources = [];
  try {
    sources = await webSearch(question, { num: 5 });
  } catch (e) {
    sources = [];
  }

  // ضمان Array + تنظيف العناصر الفارغة
  if (!Array.isArray(sources)) sources = [];
  sources = sources.filter(Boolean);

  // 3) محاولة Gemini (قد يفشل بسبب quota)
  let llm = null;
  try {
    llm = await askoraLLM({ question, intent: safeIntent, context: safeContext, sources });
  } catch (e) {
    llm = { ok: false, text: "", error: String(e?.message || e) };
  }

  // 4) فولباك بدون نموذج (ملخص نظيف بدون روابط داخل النص)
  const finalText = llm?.ok
    ? String(llm.text || "").trim()
    : fallbackSynthesize(sources, llm?.error);

  return buildAnswer({
    question,
    intent: safeIntent,
    context: safeContext,
    final: finalText,
    sources,
    note: llm?.ok
      ? "تم توليد الإجابة عبر Gemini."
      : `تعذر تشغيل Gemini: ${llm?.error || "unknown"}. تم استخدام نتائج Google.`,
  });
}

// ✅ ملخص نظيف: يعتمد على القصاصات فقط بدون روابط داخل النص
function fallbackSynthesize(sources, err = "") {
  const top = Array.isArray(sources) ? sources.slice(0, 5) : [];

  const snippets = top
    .map((s) => String(s?.content || "").trim())
    .filter(Boolean)
    .slice(0, 5);

  if (!snippets.length) {
    return `لا تتوفر نتائج كافية حاليًا. ${String(err || "").trim()}`.trim();
  }

  return `ملخص ذكي من نتائج البحث:\n- ${snippets.join("\n- ")}`.trim();
}
