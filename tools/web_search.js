// tools/web_search.js
// Google Custom Search JSON API
// يرجّع Array من: { title, content, link }
// تحسينات: فلترة قوية + تفضيل مصادر موثوقة + تعديل الاستعلام حسب intent + منع تكرار نفس الدومين

const BLOCKED_DOMAINS = [
  "facebook.com",
  "m.facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "instagram.com",
  "pinterest.com",
  "snapchat.com",
  "threads.net",
  "youtube.com",
  "youtu.be",
  "reddit.com", // اختياري: إذا تبغى تسمح ريدت احذفه
];

const PREFERRED_DOMAINS = [
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
  "cia.gov",
  "state.gov",
  "data.un.org",
];

const EXTRA_TRUST_HINTS = [
  ".gov",
  ".edu",
  ".org",
];

function getDomain(url = "") {
  try {
    const u = new URL(url);
    return (u.hostname || "").replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isBlocked(url = "") {
  const d = getDomain(url);
  if (!d) return false;
  return BLOCKED_DOMAINS.some((x) => d === x || d.endsWith("." + x));
}

function isSpammyUrl(url = "") {
  const u = String(url || "").toLowerCase();
  // صفحات بحث داخل مواقع / صفحات وسم / صفحات نتائج
  if (u.includes("/search?") || u.includes("/search/")) return true;
  if (u.includes("?s=") || u.includes("&s=")) return true;
  if (u.includes("/tag/") || u.includes("/tags/")) return true;
  if (u.includes("/category/")) return true;
  return false;
}

function scorePreferred(url = "") {
  const d = getDomain(url);
  if (!d) return 0;

  let score = 0;

  if (PREFERRED_DOMAINS.some((x) => d === x || d.endsWith("." + x))) score += 30;

  // إشارات ثقة عامة
  if (d.endsWith(".gov") || d.includes(".gov.")) score += 18;
  if (d.endsWith(".edu") || d.includes(".edu.")) score += 14;
  if (d.endsWith(".org") || d.includes(".org.")) score += 8;

  // تلميحات إضافية
  if (EXTRA_TRUST_HINTS.some((h) => d.endsWith(h) || d.includes(h))) score += 4;

  return score;
}

function normalizeItem(item) {
  const title = String(item?.title || "").trim();
  const link = String(item?.link || "").trim();
  const content = String(item?.snippet || item?.htmlSnippet || "").trim();
  return { title, link, content };
}

function cleanSnippet(text = "", max = 320) {
  const t = String(text || "")
    .replace(/<[^>]*>/g, "") // تنظيف htmlSnippet إن وجد
    .replace(/\s+/g, " ")
    .replace(/\uFFFD/g, "")
    .trim();

  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + "…";
}

async function fetchWithTimeout(url, { timeoutMs = 12000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

// صياغة استعلام أفضل حسب intent (بدون تضييق زيادة)
function enrichQuery(q, intent = "") {
  const base = String(q || "").trim();
  if (!base) return base;

  const it = String(intent || "").trim();

  // إضافات خفيفة تساعد جوجل يفهم النوع
  if (it === "where") return `${base} موقعها أين تقع حدودها`;
  if (it === "who_is") return `${base} من هو سيرة ذاتية معلومات`;
  if (it === "define") return `${base} تعريف معنى ما هو`;
  if (it === "how") return `${base} طريقة خطوات شرح`;
  if (it === "how_many") return `${base} كم عدد كم سعر إحصائيات`;
  if (it === "news") return `${base} آخر الأخبار تحديث اليوم`;
  if (it === "compare") return `${base} مقارنة الفرق بين`;

  return base;
}

function dedupeByLink(items) {
  const seen = new Set();
  return items.filter((x) => {
    if (!x.link) return false;
    if (seen.has(x.link)) return false;
    seen.add(x.link);
    return true;
  });
}

// تقليل تكرار نفس الدومين (لو جوجل رجع 5 نتائج كلها من نفس الموقع)
function limitPerDomain(items, maxPerDomain = 2) {
  const count = new Map();
  const out = [];
  for (const it of items) {
    const d = getDomain(it.link);
    const c = (count.get(d) || 0) + 1;
    if (c > maxPerDomain) continue;
    count.set(d, c);
    out.push(it);
  }
  return out;
}

/**
 * webSearch
 * @param {string} query
 * @param {Object} opts
 * @param {number} opts.num
 * @param {string} opts.intent
 * @returns {Promise<Array<{title:string, content:string, link:string}>>}
 */
export async function webSearch(query, { num = 5, intent = "" } = {}) {
  const rawQ = String(query || "").trim();
  if (!rawQ) return [];

  const key = (process?.env?.GOOGLE_CSE_KEY || "").trim();
  const cx = (process?.env?.GOOGLE_CSE_CX || "").trim();

  if (!key || !cx) {
    return [];
  }

  const n = Math.max(1, Math.min(10, Number(num || 5)));
  const q = enrichQuery(rawQ, intent);

  // ✅ lr=lang_ar يساعد يقلل لغات ثانية
  // hl=ar تعريب، gl=ye حسب رغبتك
  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(q)}` +
    `&num=${n}` +
    `&hl=ar` +
    `&lr=lang_ar` +
    `&gl=ye` +
    `&safe=active`;

  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });

  if (!res.ok) {
    return [];
  }

  const data = await res.json().catch(() => null);
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) return [];

  // Normalize
  let out = items.map(normalizeItem);

  // فلترة قوية
  out = out.filter((x) => x.link && !isBlocked(x.link) && !isSpammyUrl(x.link));

  // تنظيف النص
  out = out.map((x) => ({
    title: String(x.title || "").trim(),
    link: String(x.link || "").trim(),
    content: cleanSnippet(x.content, 320),
  }));

  // إزالة تكرار نفس الرابط
  out = dedupeByLink(out);

  // ترتيب حسب أفضلية الدومين + وجود محتوى
  out = out
    .map((x) => ({
      ...x,
      _score: scorePreferred(x.link) + (x.content ? 5 : 0) + (x.title ? 3 : 0),
    }))
    .sort((a, b) => (b._score || 0) - (a._score || 0))
    .map(({ _score, ...rest }) => rest);

  // تقليل تكرار نفس الدومين
  out = limitPerDomain(out, 2);

  return out.slice(0, n);
}
