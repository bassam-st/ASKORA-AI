// answer/smart_summarizer.js
// Smart Summarizer v2 (بدون نموذج)
// - يقرأ snippets من المصادر ويطلع خلاصة "مفيدة" حسب النية
// - خاص: schedule -> رد "بيانات/روابط" وليس شرح عام

function clean(s = "") {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\uFFFD/g, "")
    .trim();
}

function clip(s = "", max = 420) {
  const t = clean(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function getHost(url = "") {
  try {
    const u = new URL(url);
    return (u.hostname || "").replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pickTopSources(sources = [], n = 4) {
  const arr = Array.isArray(sources) ? sources : [];
  const out = [];
  const seen = new Set();

  for (const s of arr) {
    if (!s) continue;
    const link = clean(s.link);
    if (link && seen.has(link)) continue;
    if (link) seen.add(link);
    out.push({
      title: clean(s.title),
      link,
      content: clip(s.content, 360),
      host: getHost(link),
    });
    if (out.length >= n) break;
  }
  return out;
}

function makeSourcesBlock(picked = []) {
  if (!picked.length) return "• لا توجد مصادر كافية حالياً.";
  return picked
    .map((s, i) => {
      const name = s.host || s.title || `مصدر ${i + 1}`;
      return `• ${name}${s.link ? `: ${s.link}` : ""}`;
    })
    .join("\n");
}

// محاولة استخراج "معلومة رقمية" بسيطة من snippets (تواريخ/أرقام/توقيت…)
function extractSignals(text = "") {
  const t = clean(text);
  if (!t) return [];

  const hits = [];

  // أوقات/نتائج محتملة
  const timeLike = t.match(/\b(\d{1,2}:\d{2})\b/g);
  if (timeLike?.length) hits.push(...timeLike.slice(0, 4));

  // تواريخ
  const dateLike = t.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g);
  if (dateLike?.length) hits.push(...dateLike.slice(0, 3));

  // أرقام
  const nums = t.match(/\b\d{2,}\b/g);
  if (nums?.length) hits.push(...nums.slice(0, 3));

  // تنظيف تكرار
  return Array.from(new Set(hits)).slice(0, 6);
}

function joinSnippetsForScan(sources = []) {
  return (Array.isArray(sources) ? sources : [])
    .slice(0, 6)
    .map((s) => clean(s?.content))
    .filter(Boolean)
    .join(" | ");
}

function isScheduleIntent(intent = "") {
  return String(intent || "").trim().toLowerCase() === "schedule";
}

export function smartSummarize({ question = "", intent = "general", sources = [] } = {}) {
  const q = clean(question);
  const it = String(intent || "general").trim().toLowerCase();
  const picked = pickTopSources(sources, 5);
  const scanText = joinSnippetsForScan(sources);
  const signals = extractSignals(scanText);

  // ✅ C) رد خاص للـ schedule
  if (isScheduleIntent(it)) {
    const found = picked.map((s) => s.content).filter(Boolean);
    const hasAnyUseful = found.join(" ").length > 40;

    return [
      `إليك نتيجة سريعة عن: **${q || "مباريات اليوم"}**`,
      "",
      "🔎 ماذا وجدنا من البحث:",
      hasAnyUseful
        ? `• نقاط/معلومات من المصادر: ${clip(found.join(" — "), 520)}`
        : "• المصادر لم تُظهر جدولًا كاملًا داخل المقتطفات، لكنها تُعطي صفحات الجدول مباشرة (روابط تحت).",
      signals.length ? `• إشارات (قد تتضمن وقت/تاريخ/أرقام): ${signals.join(" ، ")}` : "",
      "",
      "✅ أفضل روابط لجدول اليوم/النتائج (افتحها مباشرة):",
      makeSourcesBlock(picked),
      "",
      "❓ حتى أعطيك جدول أدق: اكتب اسم **الدوري/البلد** (مثال: الدوري السعودي، الدوري الإسباني، دوري الأبطال).",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // باقي النوايا (عام محسّن)
  const bestSnippet = picked.find((s) => s.content)?.content || "";
  const sourcesBlock = makeSourcesBlock(picked);

  const header = q ? `إليك خلاصة واضحة عن سؤالك: **${q}**` : "إليك خلاصة واضحة:";
  const body = bestSnippet
    ? `• الخلاصة من أعلى مصدر: ${clip(bestSnippet, 520)}`
    : "• لم أجد مقتطفات كافية داخل نتائج البحث، جرّب صياغة أوضح أو أضف تفاصيل.";

  const extra = signals.length ? `• إشارات/أرقام مهمة ظهرت: ${signals.join(" ، ")}` : "";

  return [
    header,
    "",
    "أهم النقاط:",
    body,
    extra,
    "",
    "المصادر:",
    sourcesBlock,
  ]
    .filter(Boolean)
    .join("\n");
}
