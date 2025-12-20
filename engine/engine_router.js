// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";
import { smartSummarize } from "../answer/smart_summarizer.js";

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

  // 1) الذاكرة الطويلة أولاً
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
  } catch {
    // تجاهل مشاكل الذاكرة
  }

  // 2) بحث Google (دائمًا)
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(question, { num: 6 });
  } catch {
    sourcesRaw = [];
  }

  // 2.1) توحيد شكل المصادر
  const sources = normalizeSources(sourcesRaw);

  // 3) محاولة Gemini (قد يفشل بسبب quota)
  let llm = null;
  try {
    llm = await askoraLLM({
      question,
      intent: safeIntent,
      context: safeContext,
      sources,
    });
  } catch (e) {
    llm = { ok: false, text: "", error: cleanErr(e) };
  }

  // 4) إذا Gemini شغال: استخدمه
  if (llm?.ok && String(llm.text || "").trim()) {
    return buildAnswer({
      question,
      intent: safeIntent,
      context: safeContext,
      final: String(llm.text).trim(),
      sources,
      note: "تم توليد الإجابة عبر Gemini.",
    });
  }

  // 5) فولباك "ذكي" بدون نموذج: smartSummarize
  const finalText = smartSummarize({
    question,
    intent: safeIntent,
    context: safeContext,
    sources,
  });

  const note = "تعذر تشغيل Gemini حالياً. تم استخدام تلخيص ذكي من نتائج البحث.";

  return buildAnswer({
    question,
    intent: safeIntent,
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

  return arr
    .filter(Boolean)
    .map((s) => {
      if (typeof s === "string") {
        return { title: "", content: s, link: "" };
      }
      if (typeof s === "object") {
        const title = String(s.title || s.name || "").trim();
        const content = String(s.content || s.snippet || s.text || "").trim();
        const link = String(s.link || s.url || "").trim();
        return { title, content, link };
      }
      return { title: "", content: String(s), link: "" };
    })
    .slice(0, 8);
}

function cleanErr(e) {
  const msg = String(e?.message || e || "").trim();
  return msg.length > 160 ? msg.slice(0, 160) + "..." : msg;
}
