// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";

export async function routeEngine({ text, intent, context }) {
  const question = String(text || "").trim();

  // 0) تحقق
  if (!question) {
    return buildAnswer({
      question: "",
      intent: intent || "",
      context: context || "",
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
        intent,
        context,
        final: mem.answer,
        sources: [{ title: "Long-term memory", content: mem.answer, link: "" }],
        note: "تمت الإجابة من الذاكرة الطويلة.",
      });
    }
  } catch (e) {
    // تجاهل مشاكل الذاكرة ولا توقف النظام
  }

  // 2) بحث Google (نستخدمه كـ fallback أساسي)
  const needsWeb = true; // خليها دائمًا true عشان يشتغل البحث لأي سؤال

  let sources = [];
  if (needsWeb) {
    sources = await webSearch(question, { num: 5 });
  }

  // ضمان Array
  if (!Array.isArray(sources)) sources = [];
  sources = sources.filter(Boolean);

  // 3) محاولة Gemini (قد يفشل بسبب quota)
  let llm = null;
  try {
    llm = await askoraLLM({ question, intent, context, sources });
  } catch (e) {
    llm = { ok: false, text: "", error: String(e?.message || e) };
  }

  // 4) فولباك تلقائي بدون نموذج
  const finalText = llm?.ok
    ? llm.text
    : fallbackSynthesize(intent, sources, llm?.error);

  return buildAnswer({
    question,
    intent,
    context,
    final: finalText,
    sources,
    note: llm?.ok
      ? "تم توليد الإجابة عبر Gemini."
      : `تعذر تشغيل Gemini: ${llm?.error || "unknown"}. تم استخدام نتائج Google.`,
  });
}

function fallbackSynthesize(intent, sources, err = "") {
  const top = Array.isArray(sources) ? sources.slice(0, 5) : [];

  const bullets = top
    .map((s, i) => {
      const title = s?.title ? `(${s.title})` : "";
      const snip = s?.content ? s.content : "";
      const link = s?.link ? ` - ${s.link}` : "";
      return `${i + 1}) ${title} ${snip}${link}`.trim();
    })
    .filter(Boolean)
    .join("\n");

  if (!bullets) {
    return `لم أجد نتائج كافية الآن. ${err}`.trim();
  }

  return `ملخص من نتائج Google:\n${bullets}`;
}
