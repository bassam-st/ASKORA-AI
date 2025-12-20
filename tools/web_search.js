// tools/web_search.js
// Google Custom Search JSON API
// يرجّع Array من: { title, content, link }
// مع فلترة مصادر سيئة + تفضيل مصادر قوية

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

function scorePreferred(url = "") {
  const d = getDomain(url);
  if (!d) return 0;
  return PREFERRED_DOMAINS.some((x) => d === x || d.endsWith("." + x)) ? 10 : 0;
}

function normalizeItem(item) {
  const title = String(item?.title || "").trim();
  const link = String(item?.link || "").trim();
  const content = String(item?.snippet || item?.htmlSnippet || "").trim();
  return { title, link, content };
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

/**
 * webSearch
 * @param {string} query
 * @param {Object} opts
 * @param {number} opts.num
 * @returns {Promise<Array<{title:string, content:string, link:string}>>}
 */
export async function webSearch(query, { num = 5 } = {}) {
  const q = String(query || "").trim();
  if (!q) return [];

  const key = (process?.env?.GOOGLE_CSE_KEY || "").trim();
  const cx = (process?.env?.GOOGLE_CSE_CX || "").trim();

  if (!key || !cx) {
    return [];
  }

  const n = Math.max(1, Math.min(10, Number(num || 5)));

  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(q)}` +
    `&num=${n}` +
    `&hl=ar` +
    `&gl=ye` +
    `&safe=active`;

  const res = await fetchWithTimeout(url, { timeoutMs: 12000 });

  if (!res.ok) {
    return [];
  }

  const data = await res.json().catch(() => null);
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) return [];

  let out = items.map(normalizeItem).filter((x) => x.link && !isBlocked(x.link));

  out = out
    .map((x) => ({ ...x, _p: scorePreferred(x.link) }))
    .sort((a, b) => (b._p || 0) - (a._p || 0))
    .map(({ _p, ...rest }) => rest);

  out = out.map((x) => ({
    title: x.title,
    link: x.link,
    content: String(x.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300),
  }));

  const seen = new Set();
  out = out.filter((x) => {
    if (seen.has(x.link)) return false;
    seen.add(x.link);
    return true;
  });

  return out.slice(0, n);
}
