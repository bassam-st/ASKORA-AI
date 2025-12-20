import { webSearch } from "../tools/web_search.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";

export async function routeEngine({ text, intent, context }) {
  // 1) جرّب الذاكرة الطويلة أولًا
  const mem = await searchLongTerm(text);
  if (mem) {
    return {
      answerText: mem.answer || "",
      sourcesList: ["Long-term memory"],
      note: "تمت الإجابة من الذاكرة الطويلة.",
    };
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

  // 3) استخدم Gemini
  const llm = await askoraLLM({ question: text, intent, context, sources });

  // 4) فولباك لو فشل
  const finalText = llm?.ok
    ? (llm.text || "")
    : fallbackSynthesize(intent, sources, llm?.error);

  // ✅ حوّل المصادر إلى قائمة نصوص فقط (حتى لو كانت Objects)
  const sourcesList = normalizeSourcesToStrings(sources);

  return {
    answerText: finalText,
    sourcesList,
    note: llm?.ok ? "تم توليد الإجابة عبر Gemini." : `تعذر تشغيل Gemini: ${llm?.error || ""}`,
  };
}

function normalizeSourcesToStrings(sources) {
  if (!Array.isArray(sources)) return [];
  return sources
    .slice(0, 10)
    .map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        // جرّب أكثر من شكل
        if (s.title && s.url) return `${s.title} — ${s.url}`;
        if (s.title) return `${s.title}`;
        if (s.url) return `${s.url}`;
        if (s.content) return `${String(s.content).slice(0, 120)}...`;
      }
      return String(s);
    });
}

function fallbackSynthesize(intent, sources, err = "") {
  const first = sources?.[0]?.content || "";
  if (intent === "compare") return `للمقارنة: اذكر خيارين (A و B). ${first}`;
  if (intent === "price") return `تنبيه: الأسعار تتغير. ${first}`;
  if (intent === "news_or_recent") return `تنبيه: الأخبار تتغير بسرعة. ${first}`;
  return first || `لم أستطع توليد إجابة الآن. ${err}`;
}
