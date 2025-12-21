// tools/web_search.js — VINFINITY
// Google Custom Search JSON API (CSE)
// يرجّع: Array<{title, link, content}>

const BLOCKED_DOMAINS = [
  "facebook.com","m.facebook.com","x.com","twitter.com","tiktok.com","instagram.com",
  "pinterest.com","snapchat.com","threads.net","youtube.com","youtu.be"
];

const BASE_PREFERRED = [
  "wikipedia.org","britannica.com","un.org","who.int","unicef.org","worldbank.org","imf.org","oecd.org","undp.org","reliefweb.int",
  "reuters.com","apnews.com","bbc.com"
];

const INTENT_PREFERRED = {
  schedule: ["yallakora.com","koora.com","filgoal.com","365scores.com","sofascore.com"],
  news: ["reuters.com","apnews.com","bbc.com","aljazeera.net","arabnews.com"]
};

function getDomain(url=""){
  try{
    const u = new URL(url);
    return (u.hostname||"").replace(/^www\./,"").toLowerCase();
  }catch{ return ""; }
}

function isBlocked(url=""){
  const d = getDomain(url);
  if(!d) return false;
  return BLOCKED_DOMAINS.some(x => d === x || d.endsWith("." + x));
}

function scorePreferred(url="", intent="general"){
  const d = getDomain(url);
  if(!d) return 0;

  let score = 0;

  const ip = INTENT_PREFERRED[intent] || [];
  for (let i=0;i<ip.length;i++){
    const x = ip[i];
    if (d === x || d.endsWith("." + x)) score += (14 - i);
  }

  for (const x of BASE_PREFERRED){
    if (d === x || d.endsWith("." + x)) score += 6;
  }

  return score;
}

function normalizeItem(item){
  const title = String(item?.title || "").trim();
  const link = String(item?.link || "").trim();
  const content = String(item?.snippet || item?.htmlSnippet || "").trim();
  return { title, link, content };
}

async function fetchWithTimeout(url, timeoutMs=12000){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), timeoutMs);
  try{ return await fetch(url, { signal: controller.signal }); }
  finally{ clearTimeout(t); }
}

export async function webSearch(query, { num=6, intent="general" } = {}){
  const q = String(query||"").trim();
  if(!q) return [];

  const key = String(process?.env?.GOOGLE_CSE_KEY || "").trim();
  const cx  = String(process?.env?.GOOGLE_CSE_CX || "").trim();
  if(!key || !cx) return [];

  const n = Math.max(1, Math.min(10, Number(num || 6)));

  const url =
    "https://www.googleapis.com/customsearch/v1" +
    `?key=${encodeURIComponent(key)}` +
    `&cx=${encodeURIComponent(cx)}` +
    `&q=${encodeURIComponent(q)}` +
    `&num=${n}` +
    `&hl=ar` +
    `&gl=ye` +
    `&safe=active`;

  const res = await fetchWithTimeout(url, 12000);
  if(!res.ok) return [];

  const data = await res.json().catch(()=>null);
  const items = Array.isArray(data?.items) ? data.items : [];
  if(!items.length) return [];

  let out = items.map(normalizeItem).filter(x => x.link && !isBlocked(x.link));

  out = out
    .map(x => ({ ...x, _p: scorePreferred(x.link, intent) }))
    .sort((a,b)=>(b._p||0)-(a._p||0))
    .map(({_p, ...rest})=>rest);

  out = out.map(x => ({
    title: x.title,
    link: x.link,
    content: String(x.content||"").replace(/\s+/g," ").trim().slice(0, 360),
  }));

  const seen = new Set();
  out = out.filter(x => {
    if(seen.has(x.link)) return false;
    seen.add(x.link);
    return true;
  });

  return out.slice(0, n);
}
