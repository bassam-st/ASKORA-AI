// answer/smart_summarizer.js
// Smart Summarizer (No LLM) — Level 2 (Style 3)
// 1) جواب مباشر
// 2) ملخص
// 3) نقاط مهمة
// 4) أرقام/تواريخ (إن وجدت)
// 5) ملاحظة/تحذير
//
// Level 2 adds:
// - better cleaning & de-dup
// - extracting numbers & dates
// - stronger templates per intent
// - basic "weak snippet" handling

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

const BAD_HINTS = [
  "facebook",
  "twitter",
  "x.com",
  "tiktok",
  "instagram",
  "threads",
  "pinterest",
  "#",
  "@",
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

  if (domain) {
    if (TRUSTED_DOMAINS.some((d) => domain === d || domain.endsWith("." + d))) score += 50;
    if (domain.includes("wikipedia.org")) score += 15;
  }

  const titleLen = String(s?.title || "").trim().length;
  const contLen = String(s?.content || "").trim().length;
  score += Math.min(10, titleLen / 12);
  score += Math.min(20, contLen / 25);

  if (!link) score -= 10;
  if (!String(s?.content || "").trim()) score -= 10;

  return score;
}

function cleanText(t = "") {
  let x = String(t || "");
  x = x.replace(/\uFFFD/g, "");
  x = x.replace(/<[^>]*>/g, " "); // remove html
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

function looksBadLine(line = "") {
  const l = String(line || "").toLowerCase();
  if (!l) return true;
  if (l.length < 10) return true;
  if (BAD_HINTS.some((h) => l.includes(h))) return true;
  // كثير رموز/روابط
  if ((l.match(/http/g) || []).length >= 1) return true;
  // عبارات "انقر هنا" الخ
  if (/(click|open|اضغط|انقر|تابع|شاهد)/i.test(l)) return true;
  return false;
}

function normalizeArabicDigits(s = "") {
  // تحويل الأرقام العربية الهندية إلى 0-9
  const map = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
    "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  };
  return String(s || "").replace(/[٠-٩]/g, (d) => map[d] || d);
}

function dedupeLines(lines = []) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const key = normalizeArabicDigits(String(line || ""))
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
  const candidate = [];
  for (const s of bestSources) {
    const title = clip(cleanText(s?.title || ""), 220);
    const content = clip(cleanText(s?.content || ""), 420);
    if (title) candidate.push(title);
    if (content) candidate.push(content);
  }

  const cleaned = dedupeLines(
    candidate
      .map((x) => clip(cleanText(x), 320))
      .filter((x) => x && !looksBadLine(x))
  );

  return cleaned.slice(0, 8);
}

function extractNumbersAndDates(lines = []) {
  const nums = new Set();
  const dates = new Set();

  const dateRegex1 = /\b(19\d{2}|20\d{2})\b/g; // years
  const dateRegex2 = /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g; // 12/08/2024
  const arabMonth = /(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)/;

  // أرقام عامة (مع وحدات بسيطة)
  const numRegex = /\b\d{1,3}(?:[,\.\s]\d{3})*(?:\.\d+)?\b/g;

  for (const raw of lines) {
    const s = normalizeArabicDigits(String(raw || ""));
    // سنوات
    const y = s.match(dateRegex1) || [];
    y.forEach((x) => dates.add(x));

    // تواريخ رقمية
    const d2 = s.match(dateRegex2) || [];
    d2.forEach((x) => dates.add(x));

    // تواريخ عربية شهر + سنة
    if (arabMonth.test(s)) {
      // خذ جملة قصيرة فيها الشهر
      const idx = s.search(arabMonth);
      const snippet = clip(s.slice(Math.max(0, idx - 30), idx + 40), 90);
      if (snippet) dates.add(snippet);
    }

    // أرقام
    const n = s.match(numRegex) || [];
    n.forEach((x) => {
      const v = x.replace(/\s/g, "").replace(/,/g, "");
      // تجاهل أرقام قصيرة جدًا
      if (v.length >= 2) nums.add(v);
    });
  }

  // حد أقصى
  return {
    numbers: Array.from(nums).slice(0, 6),
    dates: Array.from(dates).slice(0, 6),
  };
}

function pickDirectAnswer(intent, question, lines) {
  const q = String(question || "").trim();
  const first = lines[0] || "";
  const second = lines[1] || "";

  if (!first) return `بخصوص: "${q}" — هذه خلاصة من أفضل النتائج المتاحة.`;

  if (intent === "where") {
    // حاول اختيار سطر فيه "تقع/يقع/located"
    const whereLine = lines.find((l) => /(تقع|يقع|located|location|تقع في|يقع في)/i.test(l));
    if (whereLine) return whereLine;
    return `الموقع باختصار: ${first}`;
  }

  if (intent === "define") {
    const defLine = lines.find((l) => /(هو|هي|تعريف|meaning|definition|is a)/i.test(l));
    if (defLine) return defLine;
    return `التعريف باختصار: ${first}`;
  }

  if (intent === "who_is") {
    const whoLine = lines.find((l) => /(هو|هي|ولد|birth|known|is a)/i.test(l));
    if (whoLine) return whoLine;
    return `نبذة مختصرة: ${first}`;
  }

  if (intent === "how") {
    // اختر سطر يشبه خطوات/طريقة
    const howLine = lines.find((l) => /(طريقة|خطوات|step|how to|قم|افتح|ثبت)/i.test(l));
    if (howLine) return howLine;
    return `أفضل طريقة مختصرة حسب النتائج: ${first}`;
  }

  if (intent === "why") {
    const whyLine = lines.find((l) => /(سبب|because|due to|لأن)/i.test(l));
    if (whyLine) return whyLine;
    return `السبب المختصر حسب النتائج: ${first}`;
  }

  if (intent === "how_many") {
    // اختر سطر فيه رقم إن وجد
    const numLine = lines.find((l) => /\d/.test(normalizeArabicDigits(l)));
    if (numLine) return numLine;
    return second ? `الأرقام المتاحة تشير إلى: ${second}` : `الأرقام المتاحة تشير إلى: ${first}`;
  }

  return first;
}

function buildSummary(lines, intent) {
  // ملخص: دمج أفضل جملتين مع فلترة
  const a = lines[0] ? clip(lines[0], 220) : "";
  const b = lines[1] ? clip(lines[1], 220) : "";
  const c = lines[2] ? clip(lines[2], 220) : "";

  let summary = [a, b].filter(Boolean).join(" ");
  if (!summary && c) summary = c;

  summary = clip(cleanText(summary), 360);

  // تحسين بسيط حسب intent
  if (intent === "where" && summary && !/(تقع|يقع|موقع|located)/i.test(summary)) {
    summary = `الموقع/المكان: ${summary}`;
  }
  if (intent === "define" && summary && !/(تعريف|هو|هي|meaning|definition|is a)/i.test(summary)) {
    summary = `التعريف: ${summary}`;
  }

  return summary;
}

function buildBullets(lines) {
  const bullets = lines
    .slice(0, 5)
    .map((l) => clip(cleanText(l), 220))
    .filter(Boolean);

  return bullets;
}

function buildWarning(intent) {
  if (intent === "news") {
    return "تنبيه: الأخبار تتغير بسرعة. تأكد من تاريخ المصدر.";
  }
  if (intent === "how_many") {
    return "تنبيه: الأرقام/الأسعار قد تختلف حسب السنة أو الجهة أو المكان. راجع المصادر للتأكد.";
  }
  return "ملاحظة: هذه خلاصة من قصاصات البحث، راجع المصادر للتفاصيل.";
}

function formatAnswer({ direct, summary, bullets, extracted, warning }) {
  const parts = [];

  parts.push(`**الجواب المباشر:**\n${direct}`);

  if (summary) parts.push(`\n**الملخص:**\n${summary}`);

  if (bullets && bullets.length) {
    parts.push(`\n**نقاط مهمة:**\n${bullets.map((b) => `- ${b}`).join("\n")}`);
  }

  // أرقام وتواريخ
  const nums = extracted?.numbers || [];
  const dates = extracted?.dates || [];
  if (nums.length || dates.length) {
    const section = [];
    if (nums.length) section.push(`- أرقام/قيم واردة: ${nums.join(" ، ")}`);
    if (dates.length) section.push(`- تواريخ/سنوات واردة: ${dates.join(" ، ")}`);
    parts.push(`\n**أرقام وتواريخ من النتائج:**\n${section.join("\n")}`);
  }

  if (warning) parts.push(`\n**ملاحظة:**\n${warning}`);

  return parts.join("\n").trim();
}

/**
 * smartSummarize — Level 2
 * @param {Object} params
 * @param {string} params.question
 * @param {string} params.intent
 * @param {Array}  params.sources - [{title, content, link}]
 * @returns {string}
 */
export function smartSummarize({ question = "", intent = "", sources = [] } = {}) {
  const q = String(question || "").trim();
  const inferred = guessIntent(q);
  const useIntent = String(intent || "").trim() || inferred;

  const arr = Array.isArray(sources) ? sources : [];
  const normalized = arr
    .filter(Boolean)
    .map((s) => ({
      title: clip(cleanText(s?.title || ""), 200),
      content: clip(cleanText(s?.content || ""), 420),
      link: String(s?.link || "").trim(),
    }))
    .filter((s) => s.title || s.content || s.link);

  if (!normalized.length) {
    return "لم أجد نتائج كافية الآن. جرّب إعادة صياغة السؤال أو المحاولة لاحقاً.";
  }

  // أفضل مصادر
  const best = normalized
    .slice()
    .sort((a, b) => scoreSource(b) - scoreSource(a))
    .slice(0, 5);

  // سطور مرشحة
  let lines = extractCandidateLines(best);

  // لو ضعيف جدًا: اسمح بسطرين حتى لو قصيرة
  if (lines.length < 2) {
    const fallbackLines = dedupeLines(
      best
        .flatMap((s) => [s.title, s.content])
        .map((x) => clip(cleanText(x), 220))
        .filter(Boolean)
    ).slice(0, 4);
    lines = fallbackLines.length ? fallbackLines : lines;
  }

  // جواب مباشر
  const direct = pickDirectAnswer(useIntent, q, lines);

  // ملخص
  const summary = buildSummary(lines, useIntent);

  // نقاط
  const bullets = buildBullets(lines);

  // استخراج أرقام/تواريخ من نفس السطور
  const extracted = extractNumbersAndDates(lines);

  // ملاحظة
  const warning = buildWarning(useIntent);

  return formatAnswer({ direct, summary, bullets, extracted, warning });
}
