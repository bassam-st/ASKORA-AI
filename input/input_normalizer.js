// input/input_normalizer.js
// 🔹 تطبيع إدخال ذكي – مستوى متقدم
// ينظف السؤال + يمنع أخطاء JSON + يساعد النية والتلخيص

function cleanText(s = "") {
  return String(s || "")
    .replace(/\uFFFD/g, "")          // رموز تالفة
    .replace(/[<>]/g, "")            // منع HTML
    .replace(/\s+/g, " ")            // توحيد المسافات
    .trim();
}

function detectLanguage(text = "") {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "unknown";
}

function normalizeQuestion(text = "") {
  let t = cleanText(text);

  // إزالة علامات مبالغ فيها
  t = t.replace(/([؟?!.,]){2,}/g, "$1");

  // سؤال قصير جدًا
  const tooShort = t.length < 2;

  return {
    text: t,
    empty: !t,
    tooShort,
  };
}

export function normalizeInput({ text = "", context = "" } = {}) {
  const q = normalizeQuestion(text);
  const ctx = cleanText(context);

  const lang = detectLanguage(q.text);

  return {
    ok: true,
    text: q.text,
    context: ctx,
    lang,
    empty: q.empty,
    tooShort: q.tooShort,
    length: q.text.length,
  };
}
