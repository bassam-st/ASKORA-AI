// answer/smart_summarizer.js
// Smart Summarizer (No LLM) — Style (3):
// 1) جواب مباشر
// 2) ملخص
// 3) نقاط
// 4) ملاحظة/تحذير حسب نوع السؤال
//
// يعتمد على: intent + ترتيب المصادر + تنظيف القصاصات + استخراج جمل مفيدة.

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
  if (/^(ما هو|ما هي|ما معنى|اشرح|عرّف|عرف)\b/.test(q)) return "define";
  if (/^(أين|اين)\b/.test(q)) return "where";
  if (/^(كيف)\b/.test(q)) return "how";
  if (/^(لماذا|ليش)\b/.test(q)) return "why";
  if (/(كم)\b/.test(q)) return "how_many";

  // إنجليزي
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

  // دومينات موثوقة
  if (domain) {
    if (TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) score += 50;
    if (domain.includes("wikipedia.org")) score += 15;
  }

  // طول مفيد
  const titleLen = String(s?.title || "").trim().length;
  const contLen = String(s?.content || "").trim().length;
  score += Math.min(10, titleLen / 12);
  score += Math.min(20, contLen / 25);

  // عقوبات
  if (!link) score -= 10;
  if (!String(s?.content || "").trim()) score -= 10;

  return score;
}

function cleanText(t = "") {
  let x = String(t || "");
  x = x.replace(/\uFFFD/g, "");
  x = x.replace(/[•●■►▶]/g, " ");
  x = x.replace(/\s+/g, " ").trim();
  return x;
}

function clip(t = "", max = 320) {
  const x = String(t || "").trim();
  if (!x) return "";
  if (x.length <= max) return x;
  return x.slice(0, max - 1).trim() + "…";
}

function dedupeLines(lines = []) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = String(line || "")
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

function extractCandidateLines(bestSources) {
  const candidateLines = [];
  for (const s of bestSources) {
    const title = cleanText(s?.title || "");
    const content = cleanText(s?.content || "");
    if (title) candidateLines.push(title);
    if (content) candidateLines.push(content);
  }

  // تنظيف + قص + إزالة تكرار + أخذ الأفضل
  const cleaned = dedupeLines(candidateLines.map((x) => clip(cleanText(x), 320)).filter(Boolean));
  return cleaned.slice(0, 6); // نخزن أكثر، ونستخدم حسب القالب
}

function pickDirectAnswer(intent, question, lines) {
  // جواب مباشر: غالبًا من أول سطر نظيف
  // لو intent "where" حاول صياغة "تقع..."
  const q = String(question || "").trim();
  const first = lines[0] || "";

  if (!first) return `بخصوص: "${q}" — هذه خلاصة من أفضل النتائج.`;

  if (intent === "where") {
    // إذا عندنا سطر فيه "تقع" ممتاز، وإلا نرجعه كما هو
    if (/تقع|يقع|located|location/i.test(first)) return first;
    return `الموقع باختصار: ${first}`;
  }

  if (intent === "define") {
    return first.startsWith("هو") || first.startsWith("هي") ? first : `التعريف باختصار: ${first}`;
  }

  if (intent === "who_is") {
    return first.includes("هو") || first.includes("هي") ? first : `الشخص/الاسم باختصار: ${first}`;
  }

  if (intent === "how_many") {
    return `الأرقام المتاحة في النتائج تشير إلى: ${first}`;
  }

  if (intent === "how") {
    return `أفضل طريقة مختصرة حسب النتائج: ${first}`;
  }

  if (intent === "why") {
    return `السبب المختصر حسب النتائج: ${first}`;
  }

  return first;
}

function buildBullets(intent, lines) {
  // نقاط مرتبة
  const bullets = lines
    .slice(0, 5)
    .map((l) => clip(cleanText(l), 220))
    .filter(Boolean);

  if (!bullets.length) return [];

  // تحسين: لا نكرر أول نقطة لو كانت نفس الجواب المباشر غالبًا
  return bullets;
}

function buildWarning(intent) {
  if (intent === "news") {
    return "تنبيه: الأخبار تتغير بسرعة. تأكد من تاريخ المصدر.";
  }
  if (intent === "how_many") {
    return "تنبيه: الأرقام/الأسعار قد تختلف حسب السنة أو الجهة أو المكان. راجع المصادر للتأكد.";
  }
  if (intent === "general") {
    return "ملاحظة: هذه خلاصة من قصاصات البحث، راجع المصادر للتفاصيل.";
  }
  return "ملاحظة: راجع المصادر للتفاصيل والتأكد.";
}

function formatAnswer({ direct, summary, bullets, warning }) {
  const parts = [];

  // 1) جواب مباشر
  parts.push(`**الجواب المباشر:**\n${direct}`);

  // 2) ملخص
  if (summary) parts.push(`\n**الملخص:**\n${summary}`);

  // 3) نقاط
  if (bullets && bullets.length) {
    parts.push(`\n**نقاط مهمة:**\n${bullets.map((b) => `- ${b}`).join("\n")}`);
  }

  // 4) تحذير/ملاحظة
  if (warning) parts.push(`\n**ملاحظة:**\n${warning}`);

  return parts.join("\n").trim();
}

function buildSummary(lines) {
  // الملخص فقرة واحدة: نجمع أفضل جملتين
  const a = lines[0] ? clip(lines[0], 240) : "";
  const b = lines[1] ? clip(lines[1], 240) : "";
  const c = [a, b].filter(Boolean).join(" ");
  return c ? clip(cleanText(c), 360) : "";
}

/**
 * smartSummarize
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.intent
 * @param {string} params.context
 * @param {Array}  params.sources - [{title, content, link}]
 * @returns {string} جواب عربي "Style 3"
 */
export function smartSummarize({ question = "", intent = "", context = "", sources = [] } = {}) {
  const q = String(question || "").trim();
  const inferred = guessIntent(q);
  const useIntent = String(intent || "").trim() || inferred;

  const arr = Array.isArray(sources) ? sources : [];
  const normalized = arr
    .filter(Boolean)
    .map((s) => ({
      title: clip(cleanText(s?.title || ""), 180),
      content: clip(cleanText(s?.content || ""), 420),
      link: String(s?.link || "").trim(),
    }))
    .filter((s) => s.title || s.content || s.link);

  if (!normalized.length) {
    return "لم أجد نتائج كافية الآن. جرّب إعادة صياغة السؤال أو المحاولة لاحقاً.";
  }

  // اختيار أفضل 5
  const best = normalized
    .slice()
    .sort((a, b) => scoreSource(b) - scoreSource(a))
    .slice(0, 5);

  // استخراج سطور مرشحة
  const lines = extractCandidateLines(best);

  // جواب مباشر
  const direct = pickDirectAnswer(useIntent, q, lines);

  // ملخص فقرة
  const summary = buildSummary(lines);

  // نقاط
  const bullets = buildBullets(useIntent, lines);

  // تحذير
  const warning = buildWarning(useIntent);

  return formatAnswer({ direct, summary, bullets, warning });
}
