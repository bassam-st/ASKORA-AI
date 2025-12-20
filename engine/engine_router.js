// engine/engine_router.js

import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";
import { searchLongTerm } from "../memory/memory_store.js";
import { askoraLLM } from "../llm/askora_llm.js";

/* =========================================================
   نظام حدّ يومي + تحويل تلقائي للبحث المجاني
   ========================================================= */

// ملاحظة: هذا تخزين مؤقت (In-Memory)
// مناسب كبداية – على Vercel قد يُعاد تعيينه أحيانًا
const QUOTA = (globalThis.__ASKORA_QUOTA ||= new Map());

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDailyLimit() {
  const n = Number(process.env.DAILY_AI_LIMIT || "20"); // افتراضي 20 سؤال يوميًا
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function getUsedToday() {
  const key = todayKey();
  return Number(QUOTA.get(key) || 0);
}

function incrementUsage() {
  const key = todayKey();
  QUOTA.set(key, getUsedToday() + 1);
}

function quotaExceeded() {
  return getUsedToday() >= getDailyLimit();
}

/* =========================================================
   توليد إجابة مجانية من البحث فقط (بدون LLM)
   ========================================================= */
function webOnlyAnswer(question, sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return `لم أجد نتائج كافية الآن.\nحاول إعادة صياغة السؤال: "${question}"`;
  }

  const bullets = sources.slice(0, 5).map((s, i) => {
    const title = (s?.title || `مصدر ${i + 1}`).toString();
    const content = (s?.content || "").toString();
    const short = content.length > 300 ? content.slice(0, 300) + "..." : content;
    return `• ${title}: ${short}`;
  });

  return `هذه خلاصة من نتائج البحث:\n${bullets.join("\n")}`;
}

/* =========================================================
   الموجّه الرئيسي
   ========================================================= */
export async function routeEngine({ text, intent, context }) {
  /* 1) الذاكرة الطويلة */
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

  /* 2) هل نحتاج بحث ويب؟ */
  const needsWeb =
    intent === "news_or_recent" ||
    intent === "general_search" ||
    intent === "price";

  let sources = [];
  if (needsWeb) {
    sources = await webSearch(text);
  } else {
    sources = [
      {
        title: "Local reasoning",
        content: "هذا السؤال لا يتطلب بحثًا على الإنترنت.",
      },
    ];
  }

  /* 3) إذا انتهى الحد اليومي → بحث مجاني فقط */
  if (quotaExceeded()) {
    return buildAnswer({
      question: text,
      intent,
      context,
      final: webOnlyAnswer(text, sources),
      sources,
      note: `تم تجاوز الحد اليومي (${getDailyLimit()} سؤال). تم التحويل تلقائيًا إلى البحث المجاني.`,
    });
  }

  /* 4) محاولة الذكاء الاصطناعي (Gemini) */
  const llm = await askoraLLM({
    question: text,
    intent,
    context,
    sources,
  });

  // فشل Gemini (خصوصًا 429 / quota)
  if (!llm.ok) {
    const err = String(llm.error || "");

    if (
      err.includes("429") ||
      err.includes("quota") ||
      err.includes("RESOURCE_EXHAUSTED")
    ) {
      incrementUsage(); // نحسبها كمحاولة AI
      return buildAnswer({
        question: text,
        intent,
        context,
        final: webOnlyAnswer(text, sources),
        sources,
        note: "تم تجاوز حصة Gemini، تم التحويل تلقائيًا للبحث المجاني.",
      });
    }

    // فشل آخر
    return buildAnswer({
      question: text,
      intent,
      context,
      final: fallbackAnswer(intent, sources, err),
      sources,
      note: `تعذر تشغيل Gemini: ${err}`,
    });
  }

  /* 5) نجاح Gemini */
  incrementUsage();

  return buildAnswer({
    question: text,
    intent,
    context,
    final: llm.text,
    sources,
    note: `تم توليد الإجابة بالذكاء الاصطناعي (${getUsedToday()}/${getDailyLimit()} اليوم).`,
  });
}

/* =========================================================
   فولباك بسيط
   ========================================================= */
function fallbackAnswer(intent, sources, err = "") {
  const first = sources?.[0]?.content || "";
  if (intent === "compare") return `للمقارنة: اذكر خيارين (A و B).\n${first}`;
  if (intent === "price") return `تنبيه: الأسعار تتغير.\n${first}`;
  if (intent === "news_or_recent") return `تنبيه: الأخبار متغيرة.\n${first}`;
  return first || `تعذر توليد إجابة الآن.\n${err}`;
}
