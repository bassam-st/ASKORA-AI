// engine/engine_router.js
import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";

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

  // 1) ذاكرة طويلة
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
  } catch {}

  // 2) بحث
  let sourcesRaw = [];
  try {
    sourcesRaw = await webSearch(question, { num: 6 });
  } catch {
    sourcesRaw = [];
  }

  const sources = normalizeSources(sourcesRaw);

  // 3) Gemini (اختياري)
  let llm = null;
  try {
    llm = await askoraLLM({ question, intent: safeIntent, context: safeContext, sources });
  } catch (e) {
    llm = { ok: false, text: "", error: cleanErr(e) };
  }

  // 4) جواب نهائي
  const finalText =
    llm?.ok && String(llm.text || "").trim()
      ? String(llm.text).trim()
      : fallbackSynthesize(question, sources);

  // لا نعرض JSON الخطأ، فقط سطر بسيط
  const note = llm?.ok
    ? "تم توليد الإجابة عبر Gemini."
    : "Gemini غير متاح حالياً — تم إنشاء ملخص من نتائج البحث.";

  return buildAnswer({
    question,
    intent: safeIntent,
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

  return arr
    .filter(Boolean)
    .map((s) => {
      const title = String(s?.title || s?.name || "").trim();
      const link = String(s?.link || s?.url || "").trim();
      const content = String(s?.content || s?.snippet || s?.text || "").trim();
      return { title, link, content };
    })
    .filter((s) => s.link || s.content || s.title)
    .slice(0, 8);
}

// ✅ ملخص نظيف بدون سرد مقاطع غريبة
function fallbackSynthesize(question, sources) {
  const top = Array.isArray(sources) ? sources.slice(0, 5) : [];
  if (!top.length) return "لم أجد نتائج كافية الآن. جرّب صياغة أخرى.";

  // نأخذ أفضل snippet قصير من أول نتيجتين فقط
  const bestSnips = top
    .map(s => cleanSnippet(s.content))
    .filter(Boolean)
    .slice(0, 2);

  const first = bestSnips[0] || "";
  const second = bestSnips[1] ? ("\n" + bestSnips[1]) : "";

  return `ملخص من نتائج البحث عن: "${question}"\n\n${first}${second}`.trim();
}

function cleanSnippet(text) {
  let t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  // قصّ الطول
  if (t.length > 260) t = t.slice(0, 260).trim() + "...";
  return t;
}

function cleanErr(e) {
  const msg = String(e?.message || e || "").trim();
  return msg.length > 140 ? msg.slice(0, 140) + "..." : msg;
}
