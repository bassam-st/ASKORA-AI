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
        sources: [
          { title: "Long-term memory", content: String(mem.answer), link: "" },
        ],
        note: "تمت الإجابة من الذاكرة الطويلة.",
      });
    }
  } catch {
    // تجاهل مشاكل الذاكرة ولا توقف النظام
  }

  // 2) بحث Google (Fallback أساسي)
  // إذا تبي دائمًا بحث: خليها true
  const needsWeb = true;

  let sourcesRaw = [];
  if (needsWeb) {
    try {
      sourcesRaw = await webSearch(question, { num: 5 });
    } catch (e) {
      sourcesRaw = [];
    }
  }

  // 2.1) ضمان أن المصادر Array + توحيد شكلها
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

  // 4) فولباك تلقائي بدون نموذج
  const finalText =
    llm?.ok && String(llm.text || "").trim()
      ? String(llm.text).trim()
      : fallbackSynthesize(sources);

  const note =
    llm?.ok
      ? "تم توليد الإجابة عبر Gemini."
      : "تعذر تشغيل Gemini حالياً. تم استخدام نتائج Google.";

  return buildAnswer({
    question,
    intent: safeIntent,
    context: safeContext,
    final: finalText,
    sources, // مهم: الآن مصادر مضمونة Array
    note,    // مهم: لا نعرض JSON طويل
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
      // إذا جاي نص
      if (typeof s === "string") {
        return { title: "", content: s, link: "" };
      }

      // إذا جاي Object
      if (typeof s === "object") {
        const title = String(s.title || s.name || "").trim();
        const content = String(s.content || s.snippet || s.text || "").trim();
        const link = String(s.link || s.url || "").trim();
        return { title, content, link };
      }

      return { title: "", content: String(s), link: "" };
    })
    .slice(0, 8); // حد أعلى حتى لا تتضخم الواجهة

  return cleaned;
}

function fallbackSynthesize(sources) {
  const top = Array.isArray(sources) ? sources.slice(0, 5) : [];

  const bullets = top
    .map((s, i) => {
      const title = s?.title ? `(${s.title}) ` : "";
      const snip = s?.content ? s.content : "";
      const link = s?.link ? `\n${s.link}` : "";
      const line = `${i + 1}) ${title}${snip}`.trim();
      return link ? `${line}${link}` : line;
    })
    .filter(Boolean)
    .join("\n\n");

  if (!bullets) {
    return "لم أجد نتائج كافية الآن. حاول بصياغة أخرى أو بعد قليل.";
  }

  return `ملخص من نتائج Google:\n\n${bullets}`;
}

function cleanErr(e) {
  const msg = String(e?.message || e || "").trim();
  // قصّ الخطأ حتى لا يظهر JSON كامل
  return msg.length > 180 ? msg.slice(0, 180) + "..." : msg;
}
