// answer/smart_summarizer.js
// تلخيص "ذكي" بدون نموذج: فلترة + اختيار أفضل مصادر + قوالب حسب النية (intent)
// يرجّع نص عربي مرتب + نقاط قصيرة + (اختياري) إشارة للمصادر

const TRUSTED_DOMAINS = [
  "wikipedia.org",
  "britannica.com",
  "un.org",
  "who.int",
  "unicef.org",
  "worldbank.org",
  "imf.org",
  "oecd.org",
  "undp.org",
  "reliefweb.int",
  "data.un.org",
  "cia.gov",
  "state.gov",
  "gov",
];

function guessIntent(question = "") {
  const q = String(question || "").trim();

  // عربي
  if (/^(من هو|من هي|من)\b/.test(q)) return "who_is";
  if (/^(ما هو|ما هي|ما معنى|اشرح|عرف)\b/.test(q)) return "define";
  if (/^(أين|اين)\b/.test(q)) return "where";
  if (/^(كيف)\b/.test(q)) return "how";
  if (/^(لماذا|ليش)\b/.test(q)) return "why";
  if (/(كم)\b/.test(q)) return "how_many";

  // إنجليزي (لو المستخدم كتب إنجليزي)
  if (/^\s*(who|who is)\b/i.test(q)) return "who_is";
  if (/^\s*(what|what is)\b/i.test(q)) return "define";
  if (/^\s*(where)\b/i.test(q)) return "where";
  if (/^\s*(how)\b/i.test(q)) return "how";
  if (/^\s*(why)\b/i.test(q)) return "why";
  if (/^\s*(how many|how much)\b/i.test(q)) return "how_many";

  return "general";
}

function getDomain(url = "") {
  try {
    const u = new URL(url);
    return (u.hostname || "").replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function scoreSource(s) {
  const link = String(s?.link || "");
  const domain = getDomain(link);

  let score = 0;

  // تفضيل دومينات موثوقة
  if (domain) {
    if (TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) score += 50;
    if (domain.includes("wikipedia.org")) score += 15;
  }

  // تفضيل العنوان/المحتوى الأطول (لكن بدون مبالغة)
  const titleLen = String(s?.title || "").trim().length;
  const contLen = String(s?.content || "").trim().length;
  score += Math.min(10, titleLen / 12);
  score += Math.min(20, contLen / 25);

  // عقوبة لو رابط غير موجود أو محتوى فارغ
  if (!link) score -= 15;
  if (!String(s?.content || "").trim()) score -= 10;

  return score;
}

function cleanText(t = "") {
  let x = String(t || "");

  // إزالة محارف غريبة
  x = x.replace(/\uFFFD/g, "");
  x = x.replace(/[•●■►▶]/g, " ");
  x = x.replace(/\s+/g, " ").trim();

  // قصّ مبدئي
  if (x.length > 320) x = x.slice(0, 320).trim() + "…";
  return x;
}

function dedupeLines(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = line
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

function buildTemplate(intent, question, bestLines) {
  const q = String(question || "").trim();

  const lines = bestLines.filter(Boolean);
  const first = lines[0] || "";
  const second = lines[1] || "";
  const third = lines[2] || "";

  // قالب حسب intent
  if (intent === "where") {
    // مثال: أين تقع اليمن؟
    return [
      `**الإجابة المختصرة:**`,
      first ? `- ${first}` : `- ${q}: لم تتوفر جملة واضحة من النتائج، راجع المصادر بالأسفل.`,
      second ? `- ${second}` : "",
      third ? `- ${third}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (intent === "who_is") {
    return [
      `**تعريف مختصر:**`,
      first ? `- ${first}` : `- لا توجد معلومات كافية في القصاصات المتاحة.`,
      second ? `- ${second}` : "",
      `\n**ملاحظة:** إذا كان الاسم لشخص غير مشهور، جرّب إضافة (المدينة/الوظيفة/المجال) لتحسين الدقة.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (intent === "define") {
    return [
      `**التعريف:**`,
      first ? `- ${first}` : `- لا توجد جملة تعريف واضحة في النتائج.`,
      second ? `- ${second}` : "",
      third ? `- ${third}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (intent === "how_many") {
    return [
      `**الملخص (أرقام/إحصاءات):**`,
      first ? `- ${first}` : `- لم أجد رقمًا واضحًا في القصاصات المتاحة.`,
      second ? `- ${second}` : "",
      third ? `- ${third}` : "",
      `\n**نصيحة:** جرّب إضافة السنة أو الدولة أو الوحدة المطلوبة.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (intent === "how" || intent === "why") {
    return [
      `**الخلاصة:**`,
      first ? `- ${first}` : `- لا توجد صياغة واضحة للإجابة في القصاصات، راجع المصادر.`,
      second ? `- ${second}` : "",
      third ? `- ${third}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // عام
  return [
    `**ملخص ذكي من نتائج البحث:**`,
    first ? `- ${first}` : `- لم أجد نتائج كافية الآن.`,
    second ? `- ${second}` : "",
    third ? `- ${third}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * smartSummarize
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.intent
 * @param {string} params.context
 * @param {Array}  params.sources - [{title, content, link}]
 * @returns {string} نص جواب مرتب
 */
export function smartSummarize({ question = "", intent = "", context = "", sources = [] } = {}) {
  const q = String(question || "").trim();
  const inferred = guessIntent(q);
  const useIntent = String(intent || "").trim() || inferred;

  const arr = Array.isArray(sources) ? sources : [];
  const normalized = arr
    .filter(Boolean)
    .map((s) => ({
      title: cleanText(s?.title || ""),
      content: cleanText(s?.content || ""),
      link: String(s?.link || "").trim(),
    }))
    .filter((s) => s.title || s.content || s.link);

  if (!normalized.length) {
    return "لم أجد نتائج كافية الآن. جرّب إعادة صياغة السؤال أو المحاولة لاحقاً.";
  }

  // اختيار أفضل 5 حسب السكور
  const best = normalized
    .slice()
    .sort((a, b) => scoreSource(b) - scoreSource(a))
    .slice(0, 5);

  // استخراج "جمل مفيدة" من القصاصات
  const candidateLines = [];
  for (const s of best) {
    const t = s.title ? s.title : "";
    const c = s.content ? s.content : "";
    if (t) candidateLines.push(t);
    if (c) candidateLines.push(c);
  }

  const cleanedLines = dedupeLines(
    candidateLines
      .map(cleanText)
      .filter(Boolean)
      .map((x) => x.replace(/\s*-\s*/g, " - ").trim())
  ).slice(0, 3);

  const answer = buildTemplate(useIntent, q, cleanedLines);

  // لم نستخدم context الآن، تركناه للترقيات لاحقاً
  return answer.trim();
}
