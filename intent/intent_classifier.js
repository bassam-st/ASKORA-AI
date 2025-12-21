// intent/intent_classifier.js — VINFINITY
// نية قوية + تتحمل أسئلة ناقصة + تدعم "مباريات اليوم"

function norm(s=""){
  return String(s||"").trim().toLowerCase().replace(/\uFFFD/g,"").replace(/\s+/g," ");
}

function stripPunct(s=""){
  return String(s||"").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
}

function scoreMatch(text, rules){
  let score = 0;
  for (const r of rules) if (r.re.test(text)) score += r.w;
  return score;
}

function keywords(question=""){
  const t = stripPunct(norm(question));
  if(!t) return [];
  const parts = t.split(" ").filter(Boolean);

  const stop = new Set([
    "في","على","من","الى","إلى","عن","ما","ماذا","هل","كم","كيف","لماذا","ليش","أين","اين","وين","اليوم","امس","غدا",
    "the","a","an","is","are","of","to","in","on","for","and","or","what","who","where","how","why"
  ]);

  const out = [];
  for (const w of parts){
    if (w.length < 2) continue;
    if (stop.has(w)) continue;
    out.push(w);
  }
  return out.slice(0, 12);
}

export function classifyIntent({ text="", context="" } = {}) {
  const qRaw = String(text||"").trim();
  const q = norm(qRaw);
  const ctx = norm(context);

  const RULES = {
    schedule: [
      { re: /\bمباريات\b/i, w: 45 },
      { re: /\bمباراة\b/i, w: 28 },
      { re: /\bجدول\b/i, w: 22 },
      { re: /\bنتائج\b/i, w: 20 },
      { re: /\bmatch(es)?\b/i, w: 18 },
      { re: /\bfixtures\b/i, w: 18 },
      { re: /\bscores?\b/i, w: 14 },
      { re: /\bkoora|yallakora|filgoal|sofascore|365scores\b/i, w: 20 },
    ],
    news: [
      { re: /\bآخر الأخبار\b/i, w: 28 },
      { re: /\bاخبار\b/i, w: 22 },
      { re: /\bnews|breaking\b/i, w: 25 },
    ],
    translate: [
      { re: /\bترجم\b/i, w: 35 },
      { re: /\btranslate\b/i, w: 35 },
      { re: /\bبالانجليزي|بالإنجليزي\b/i, w: 22 },
      { re: /\benglish|arabic\b/i, w: 12 },
    ],
    compare: [
      { re: /\bالفرق\b/i, w: 25 },
      { re: /\bقارن\b/i, w: 25 },
      { re: /\bأفضل\b/i, w: 15 },
      { re: /\bvs\b/i, w: 20 },
      { re: /\bcompare|difference\b/i, w: 25 },
    ],
    how_many: [
      { re: /\bكم\b/i, w: 35 },
      { re: /\bhow\s+many\b/i, w: 40 },
      { re: /\bhow\s+much\b/i, w: 35 },
      { re: /\bسعر\b/i, w: 15 },
      { re: /\bتكلفة\b/i, w: 15 },
      { re: /\bprice|cost\b/i, w: 12 },
    ],
    why: [
      { re: /^(لماذا|ليش)\b/i, w: 45 },
      { re: /\bwhy\b/i, w: 45 },
      { re: /\bسبب\b/i, w: 12 },
    ],
    where: [
      { re: /^(أين|اين|وين)\b/i, w: 45 },
      { re: /\bwhere\b/i, w: 45 },
      { re: /\bموقع\b/i, w: 15 },
      { re: /\bيقع\b/i, w: 12 },
    ],
    define: [
      { re: /^(ما هو|ما هي|ما معنى|اشرح|عرّف|عرف)\b/i, w: 40 },
      { re: /\bwhat\s+is\b/i, w: 40 },
      { re: /\bmeaning|definition\b/i, w: 15 },
    ],
    who_is: [
      { re: /^(من هو|من هي|من)\b/i, w: 40 },
      { re: /\bwho\s+is\b/i, w: 40 },
    ],
    how: [
      { re: /^(كيف)\b/i, w: 40 },
      { re: /\bhow\b/i, w: 40 },
      { re: /\bطريقة|خطوات\b/i, w: 15 },
      { re: /\bsetup|install|configure|deploy|vercel|github\b/i, w: 18 },
    ],
    general: [{ re: /.*/i, w: 1 }],
  };

  const scores = {};
  for (const k of Object.keys(RULES)) scores[k] = scoreMatch(q, RULES[k]);

  // سياق تقني
  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) scores.how += 10;

  // اختيار أعلى نية
  let best = "general";
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)){
    if (v > bestScore){ bestScore = v; best = k; }
  }

  // الثقة
  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const top1 = sorted[0] || ["general",0];
  const top2 = sorted[1] || ["general",0];
  const margin = Math.max(0, (top1[1] - top2[1]));

  let confidence = 0.48;
  if (top1[1] >= 60) confidence = 0.93;
  else if (top1[1] >= 45) confidence = 0.86;
  else if (top1[1] >= 28) confidence = 0.72;
  else if (top1[1] >= 15) confidence = 0.62;

  confidence = Math.min(0.98, confidence + Math.min(0.25, margin / 100));

  return { ok:true, intent: best, confidence, keywords: keywords(qRaw), debug:{ scores } };
}
