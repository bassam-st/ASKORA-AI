// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";
import { smartSummarize } from "../answer/smart_summarizer.js";
import { classifyIntent } from "../intent/intent_classifier.js";
import { evaluateConfidence } from "../answer/confidence_evaluator.js";

export async function routeEngine({ text, intent, context }) {
  const question = String(text || "").trim();
  const safeIntent = String(intent || "").trim();
  const safeContext = String(context || "").trim();

  // 0) تحقق
  if (!question) {
    const confidence = evaluateConfidence({
      answer: "السؤال فارغ.",
      sources: [],
      intent: { confidence: 0.2 },
    });

    return buildAnswer({
      question: "",
      intent: safeIntent,
      context: safeContext,
      final: "السؤال فارغ.",
      sources: [],
      note: "تم رفض الطلب لأن السؤال فارغ.",
      confidence,
    });
  }

  // 0.1) Intent تلقائي لو مش موجود
  const auto = classifyIntent({ text: question, context: safeContext });

  // ⬅️ نحافظ على intent النصي القديم إذا كان موجود
  // ونستخدم auto كـ “نية غنية” للذكاء والثقة
  const finalIntent = safeIntent || auto?.main_intent || "general";

  // 1) الذاكرة الطويلة أولاً
  try {
    const mem = await searchLongTerm(question);
    if (mem?.answer) {
      const finalText = String(mem.answer);

      const confidence = evaluateConfidence({
        answer: finalText,
        sources: [{ title: "Long-term memory", content: finalText, link: "" }],
        intent: auto || {},
      });

      return buildAnswer({
        question,
        intent: finalIntent,
        context: safeContext,
        final: finalText,
        sources: [{ title: "Long-term memory", content: finalText, link: "" }],
        note: "تمت الإجابة من الذاكرة الطويلة.",
        confidence,
      });
    }
  } catch {
    // تجاهل مشاكل الذاكرة ولا توقف النظام
  }

  // 2) بحث الويب (Fallback أساسي)
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(question, { num: 6, intent: auto || {} });
  } catch {
    sourcesRaw = [];
  }

  // 2.1) توحيد وتنظيف المصادر
  const sources = normalizeSources(sourcesRaw);

  // 3) محاولة Gemini (قد يفشل بسبب quota)
  let llmText = "";
  let usedGemini = false;

  try {
    const llm = await askoraLLM({
      question,
      intent: finalIntent,     // نص مختصر
      context: safeContext,
      sources,
      // يمكنك لاحقًا تمرير auto هنا إذا تبي
    });

    if (llm?.ok && String(llm.text || "").trim()) {
      llmText = String(llm.text).trim();
      usedGemini = true;
    }
  } catch {
    usedGemini = false;
  }

  // 4) النتيجة النهائية
  const finalText = usedGemini
    ? llmText
    : smartSummarize({
        question,
        intent: auto || {}, // ✅ هنا نستخدم الـ intent الغني للتلخيص
        sources,
      });

  const note = usedGemini
    ? "تم توليد الإجابة عبر Gemini."
    : "تم استخدام تلخيص ذكي من نتائج البحث (Gemini غير متاح حالياً).";

  // ✅ Confidence
  const confidence = evaluateConfidence({
    answer: finalText,
    sources,
    intent: auto || {},
  });

  return buildAnswer({
    question,
    intent: finalIntent,
    context: safeContext,
    final: finalText,
    sources,
    note,
    confidence,
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
    .map((s) => ({
      title: clip(s.title, 140),
      content: clip(cleanSnippet(s.content), 520),
      link: clip(s.link, 800),
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
