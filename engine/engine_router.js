// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";

export async function routeEngine({ text, intent, context }) {
  // 1) جرّب الذاكرة الطويلة أولًا
  const mem = await searchLongTerm(text);
  if (mem) {
    return buildAnswer({
      question: text,
      intent,
      context,
      final: mem.answer,
      sources: [{ title: "Long-term memory", content: mem.answer }],
      note: "تمت الإجابة من الذاكرة الطويلة.",
    });
  }

  // 2) هل يحتاج بحث؟
  const needsWeb =
    intent === "news_or_recent" ||
    intent === "general_search" ||
    intent === "price";

  let sources = [];
  if (needsWeb) {
    sources = await webSearch(text);
  } else {
    sources = [{ title: "Local reasoning", content: "لا يوجد بحث مطلوب لهذا النوع من الأسئلة." }];
  }

  // 3) استخدم النموذج اللغوي (Gemini) لصياغة إجابة طبيعية
  const llm = await askoraLLM({
    question: text,
    intent,
    context,
    sources,
  });

  // 4) لو فشل LLM لأي سبب، ارجع لفولباك بسيط
  const finalText = llm.ok
    ? llm.text
    : fallbackSynthesize(intent, sources, llm.error);

  return buildAnswer({
    question: text,
    intent,
    context,
    final: finalText,
    sources,
    note: llm.ok ? "تم توليد الإجابة عبر Gemini." : `تعذر تشغيل Gemini: ${llm.error}`,
  });
}

function fallbackSynthesize(intent, sources, err = "") {
  const first = sources?.[0]?.content || "";
  if (intent === "compare") return `للمقارنة: اذكر خيارين (A و B). ${first}`;
  if (intent === "price") return `تنبيه: الأسعار تتغير. ${first}`;
  if (intent === "news_or_recent") return `تنبيه: الأخبار تتغير بسرعة. ${first}`;
  return first || `لم أستطع توليد إجابة الآن. ${err}`;
}
