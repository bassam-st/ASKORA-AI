// tools/web_search.js
// Google Programmable Search Engine (CSE) search
// Requires env vars:
// - GOOGLE_CSE_KEY
// - GOOGLE_CSE_CX

export async function webSearch(query, { num = 5 } = {}) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  // دائمًا رجّع Array (حتى لا يظهر خطأ sources.slice(...).map)
  if (!key || !cx) {
    return [
      {
        title: "Search not configured",
        link: "",
        content:
          "Missing GOOGLE_CSE_KEY or GOOGLE_CSE_CX in Vercel Environment Variables.",
      },
    ];
  }

  const q = String(query || "").trim();
  if (!q) return [];

  const n = Math.max(1, Math.min(Number(num) || 5, 10));
  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(q)}` +
    `&num=${encodeURIComponent(n)}`;

  const res = await fetch(url, { method: "GET" });

  if (!res.ok) {
    const t = await safeText(res);
    return [
      {
        title: "Google Search Error",
        link: "",
        content: `HTTP ${res.status}: ${t}`,
      },
    ];
  }

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return items.slice(0, n).map((it) => ({
    title: it?.title || "Result",
    link: it?.link || "",
    content: it?.snippet || "",
  }));
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
