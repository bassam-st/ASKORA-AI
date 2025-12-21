// input/input_normalizer.js
// تنظيف/تطبيع السؤال لرفع الدقة مع أخطاء الكتابة العربية والتمطيط
// ✅ يصدر normalizeInput (مهم لتفادي خطأ Vercel السابق)

function normSpaces(s = "") {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function normalizeArabic(s = "") {
  let t = String(s || "");

  // توحيد أشكال الأحرف
  t = t
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه");

  // إزالة التشكيل
  t = t.replace(/[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]/g, "");

  // إزالة مدّ (ــــ)
  t = t.replace(/\u0640/g, "");

  return t;
}

function deDuplicateLetters(s = "") {
  // تقليل تكرار الحروف المبالغ فيه: "مبااااريات" -> "مباريات"
  // نسمح بتكرارين كحد أعلى
  return String(s || "").replace(/(.)\1{2,}/g, "$1$1");
}

function stripWeird(s = "") {
  return String(s || "")
    .replace(/\uFFFD/g, "")
    .replace(/[^\p{L}\p{N}\s\-\_\/\:\.]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeInput({ text = "", context = "" } = {}) {
  const raw = String(text || "");
  const rawCtx = String(context || "");

  let t = raw;
  t = stripWeird(t);
  t = normalizeArabic(t);
  t = deDuplicateLetters(t);
  t = normSpaces(t);

  let ctx = rawCtx;
  ctx = stripWeird(ctx);
  ctx = normalizeArabic(ctx);
  ctx = deDuplicateLetters(ctx);
  ctx = normSpaces(ctx);

  // قص طول مبالغ (يحسن السرعة)
  if (t.length > 600) t = t.slice(0, 600);
  if (ctx.length > 600) ctx = ctx.slice(0, 600);

  return { ok: true, text: t, context: ctx, raw: raw };
}
