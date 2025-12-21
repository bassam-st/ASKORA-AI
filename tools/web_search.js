// tools/web_search.js
// Advanced Web Search Engine (Level Pro)
// Features:
// - Intent-aware query rewriting
// - Source scoring & ranking
// - Strong domain preference
// - Noise reduction (social / weak pages)

const BLOCKED_DOMAINS = [
  "facebook.com","m.facebook.com","x.com","twitter.com",
  "tiktok.com","instagram.com","pinterest.com",
  "snapchat.com","threads.net","youtube.com","youtu.be"
];

const PREFERRED_DOMAINS = [
  "wikipedia.org","britannica.com",
  "un.org","who.int","unicef.org",
  "worldbank.org","imf.org","oecd.org",
  "undp.org","reliefweb.int",
  "cia.gov","state.gov","gov"
];

// ---------- Helpers ----------
function getDomain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isBlocked(url = "") {
  const d = getDomain(url);
  return BLOCKED_DOMAINS.some(b => d === b || d.endsWith("." + b));
}

function domainScore(url = "") {
  const d = getDomain(url);
  if (!d) return 0;
  return PREFERRED_DOMAINS.some(p => d === p || d.endsWith("." + p)) ? 10 : 0;
}

function cleanText(s = "") {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function normalizeItem(item) {
  return {
    title: cleanText(item?.title),
    link: cleanText(item?.link),
    content: cleanText(item?.snippet || item?.htmlSnippet || "")
  };
}

// ---------- Query Rewriting ----------
function rewriteQueries(query, intent) {
  const q = query.trim();
  const list = [q];

  if (intent?.main_intent === "geography") {
    list.push(`${q} الموقع`);
    list.push(`أين تقع ${q}`);
  }

  if (intent?.main_intent === "person") {
    list.push(`${q} السيرة الذاتية`);
    list.push(`من هو ${q}`);
  }

  if (intent?.main_intent === "economy") {
    list.push(`${q} إحصائيات`);
    list.push(`${q} الاقتصاد`);
  }

  if (intent?.question_type === "definition") {
    list.push(`تعريف ${q}`);
    list.push(`${q} meaning`);
  }

  // إزالة التكرار
  return [...new Set(list)].slice(0, 3);
}

// ---------- Fetch ----------
async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---------- Main ----------
export async function webSearch(query, { num = 5, intent = {} } = {}) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx  = process.env.GOOGLE_CSE_CX;

  if (!key || !cx || !query) return [];

  const queries = rewriteQueries(query, intent);
  let allResults = [];

  for (const q of queries) {
    const url =
      "https://www.googleapis.com/customsearch/v1" +
      `?key=${encodeURIComponent(key)}` +
      `&cx=${encodeURIComponent(cx)}` +
      `&q=${encodeURIComponent(q)}` +
      `&num=${Math.min(num, 10)}` +
      `&hl=ar&safe=active`;

    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) continue;

      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      allResults.push(
        ...items
          .map(normalizeItem)
          .filter(x => x.link && !isBlocked(x.link))
          .map(x => ({
            ...x,
            score: domainScore(x.link) + (x.content.length > 120 ? 2 : 0)
          }))
      );
    } catch {
      continue;
    }
  }

  // دمج + ترتيب + إزالة تكرار
  const seen = new Set();
  const ranked = allResults
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .filter(x => {
      if (seen.has(x.link)) return false;
      seen.add(x.link);
      return true;
    })
    .slice(0, num)
    .map(({ score, ...rest }) => rest);

  return ranked;
}
