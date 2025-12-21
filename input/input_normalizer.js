// input/input_normalizer.js — VINFINITY
// ✅ مهم: export باسم normalizeInput لتجنب خطأ "لا يوفر تصديراً باسم …"

function cleanSpaces(s=""){
  return String(s||"")
    .replace(/\uFFFD/g,"")
    .replace(/\r/g," ")
    .replace(/\t/g," ")
    .replace(/[ ]{2,}/g," ")
    .trim();
}

function normalizeArabic(s=""){
  let t = String(s||"");
  t = t
    .replace(/[إأٱآا]/g,"ا")
    .replace(/ى/g,"ي")
    .replace(/ؤ/g,"و")
    .replace(/ئ/g,"ي")
    .replace(/ة/g,"ه");
  // remove tashkeel
  t = t.replace(/[\u064B-\u065F\u0670]/g,"");
  return t;
}

function softTypos(s=""){
  // تصحيح خفيف لأكثر الأخطاء شيوعاً (تقدر تزيد لاحقاً)
  return String(s||"")
    .replace(/\bمباريت\b/g,"مباريات")
    .replace(/\bمبارياتت\b/g,"مباريات")
    .replace(/\bمبارياات\b/g,"مباريات")
    .replace(/\bيللاكوره\b/g,"يلا كوره")
    .replace(/\bياللاكوره\b/g,"يلا كوره")
    .replace(/\bيلاكوره\b/g,"يلا كوره")
    .replace(/\bيلاكووره\b/g,"يلا كوره");
}

export function normalizeInput({ text="", context="" } = {}) {
  const rawText = cleanSpaces(text);
  const rawContext = cleanSpaces(context);

  // normalized text (help intent + search)
  const normText = cleanSpaces(softTypos(normalizeArabic(rawText))).toLowerCase();

  return {
    ok: true,
    text: rawText,
    text_normalized: normText,
    context: rawContext,
  };
}

export default normalizeInput;
