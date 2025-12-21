// input/input_normalizer.js
// تنظيف السؤال + استخراج سياق بسيط + تقليم الطول
// Export: normalizeInput({text, context}) -> { text, context, meta }

function cleanSpaces(s = "") {
  return String(s || "")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDangerous(s = "") {
  // يمنع إدخال ضخم أو رموز غريبة جداً
  return cleanSpaces(s).replace(/[\u0000-\u001F]/g, " ").trim();
}

function clip(s = "", max = 2000) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function normalizeArabic(s = "") {
  // توحيد بسيط جدًا بدون كسر الكلمات
  return String(s || "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
}

function looksLikeUrl(s = "") {
  const t = String(s || "").trim();
  return /^https?:\/\/\S+/i.test(t);
}

function enrichContext({ text, context }) {
  const t = (text || "").toLowerCase();
  let ctx = (context || "").toLowerCase();

  // إشارات مفيدة للمصنف/المحرك
  if (t.includes("vercel") || t.includes("deploy") || t.includes("نشر")) ctx += " vercel deploy";
  if (t.includes("github") || t.includes("repo") || t.includes("جيت")) ctx += " github repo";
  if (t.includes("hs") || t.includes("بند") || t.includes("جمارك")) ctx += " customs hs";

  // لو السؤال مجرد رابط، نضيف سياق أنه URL
  if (looksLikeUrl(text)) ctx += " url";

  return cleanSpaces(ctx);
}

/**
 * normalizeInput
 * @param {{text:string, context?:string}} param0
 * @returns {{text:string, context:string, meta:Object}}
 */
export function normalizeInput({ text = "", context = "" } = {}) {
  let q = stripDangerous(text);
  let ctx = stripDangerous(context);

  // تطويل/تقليم ذكي
  q = clip(q, 1200);
  ctx = clip(ctx, 800);

  // لا نغير النص النهائي كثيرًا (بس نسخة meta للتصنيف إن أحببت)
  const meta = {
    normalized_for_match: normalizeArabic(q.toLowerCase()),
    is_url: looksLikeUrl(q),
    len: q.length,
  };

  ctx = enrichContext({ text: q, context: ctx });

  return { text: q, context: ctx, meta };
}

export default normalizeInput;
