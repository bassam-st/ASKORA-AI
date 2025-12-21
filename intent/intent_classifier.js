// intent/intent_classifier.js — V15
// نية قوية + تتحمل أسئلة ناقصة + أخطاء كتابة بسيطة
// ✅ schedule مخصص للمباريات/النتائج/البث

function norm(s = "") {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\uFFFD/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function stripPunct(s = "") {
  return String(s || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// تبسيط تكرار الحروف: مبااااريات -> مباريات
function squashRepeats(s = "") {
  return String(s || "").replace(/(.)\1{2,}/g, "$1$1");
}

// تصحيحات شائعة خفيفة
function cheapTypos(s = "") {
  let t = String(s || "");
  t = t.replace(/\bيللا\s*كوره\b/g, "yallakora");
  t = t.replace(/\bيلا\s*كوره\b/g, "yallakora");
  t = t.replace(/\bكوره\b/g, "كوورة").replace(/\bكووره\b/g, "كوورة");
  return t;
}

function scoreMatch(text, rules) {
  let score = 0;
  for (const r of rules) if (r.re.test(text)) score += r.w;
  return score;
}

function keywords(question = "") {
  const t = stripPunct(norm(question));
  if (!t) return [];
  const parts = t.split(" ").filter(Boolean);

  const stop = new Set([
    "في","على","من","الى","إلى","عن","ما","ماذا","هل","كم","كيف","لماذا","ليش","أين","اين","وين",
    "اليوم","امس","غدا","بكره","الان","الآن",
    "the","a","an","is","are","of","to","in","on","for","and","or","what","who","where","how","why"
  ]);

  const out = [];
  for (const w of parts) {
    if (w.length < 2) continue;
    if (stop.has(w)) continue;
    out.push(w);
  }
  return out.slice(0, 12);
}

export function classifyIntent({ text = "", context = "" } = {}) {
  const qRaw = String(text || "").trim();
  const ctxRaw = String(context || "").trim();

  let q = norm(qRaw);
  q = squashRepeats(q);
  q = cheapTypos(q);
  q = stripPunct(q);

  const ctx = norm(ctxRaw);

  const RULES = {
    schedule: [
      { re: /\bمباريات\b/i, w: 50 },
      { re: /\bمباراه\b/i, w: 34 },
      { re: /\bجدول\b/i, w: 22 },
      { re: /\bنتايج\b/i, w: 22 },
      { re: /\bنتائج\b/i, w: 22 },
      { re: /\bبث\b/i, w: 20 },
      { re: /\bمشاهده\b/i, w: 18 },
      { re: /\bلايف\b/i, w: 16 },
      { re: /\bقناه\b/i, w: 14 },
      { re: /\bmatch(es)?\b/i, w: 18 },
      { re: /\bfixtures\b/i, w: 18 },
      { re: /\bscores?\b/i, w: 16 },
      { re: /\bkoora|yallakora|filgoal|sofascore|365scores\b/i, w: 24 },
      { re: /\bالدوري\b/i, w: 12 },
      { re: /\bكاس\b/i, w: 10 },
    ],
    news: [
      { re: /\bاخر\s+الاخبار\b/i, w: 28 },
      { re: /\bاخبار\b/i, w: 22 },
      { re: /\bnews|breaking\b/i, w: 25 },
    ],
    translate: [
      { re: /\bترجم\b/i, w: 35 },
      { re: /\btranslate\b/i, w: 35 },
      { re: /\bبالانجليزي|بالانجليزيه|بالإنجليزي\b/i, w: 22 },
      { re: /\benglish|arabic\b/i, w: 12 },
    ],
    compare: [
      { re: /\bالفرق\b/i, w: 25 },
      { re: /\bقارن\b/i, w: 25 },
      { re: /\bافضل\b/i, w: 15 },
      { re: /\bvs\b/i, w: 20 },
      { re: /\bcompare|difference\b/i, w: 25 },
    ],
    how_many: [
      { re: /\bكم\b/i, w: 35 },
      { re: /\bhow\s+many\b/i, w: 40 },
      { re: /\bhow\s+much\b/i, w: 35 },
      { re: /\bسعر\b/i, w: 15 },
      { re: /\bتكلفه\b/i, w: 15 },
      { re: /\bprice|cost\b/i, w: 12 },
    ],
    why: [
      { re: /^(لماذا|ليش)\b/i, w: 45 },
      { re: /\bwhy\b/i, w: 45 },
      { re: /\bسبب\b/i, w: 12 },
    ],
    where: [
      { re: /^(اين|وين)\b/i, w: 45 },
      { re: /\bwhere\b/i, w: 45 },
      { re: /\bموقع\b/i, w: 15 },
      { re: /\bيقع\b/i, w: 12 },
    ],
    define: [
      { re: /^(ما\s+هو|ما\s+هي|ما\s+معنى|اشرح|عرف)\b/i, w: 40 },
      { re: /\bwhat\s+is\b/i, w: 40 },
      { re: /\bmeaning|definition\b/i, w: 15 },
    ],
    who_is: [
      { re: /^(من\s+هو|من\s+هي|من)\b/i, w: 40 },
      { re: /\bwho\s+is\b/i, w: 40 },
    ],
    how: [
      { re: /^(كيف)\b/i, w: 40 },
      { re: /\bhow\b/i, w: 40 },
      { re: /\bطريقه|خطوات\b/i, w: 15 },
      { re: /\bsetup|install|configure|deploy|vercel|github\b/i, w: 18 },
    ],
    general: [{ re: /.*/i, w: 1 }],
  };

  const scores = {};
  for (const k of Object.keys(RULES)) scores[k] = scoreMatch(q, RULES[k]);

  // تعزيز سياق تقني
  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) scores.how += 10;

  // اختيار أعلى نية
  let best = "general";
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) { bestScore = v; best = k; }
  }

  // الثقة
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top1 = sorted[0] || ["general", 0];
  const top2 = sorted[1] || ["general", 0];
  const margin = Math.max(0, top1[1] - top2[1]);

  let confidence = 0.50;
  if (top1[1] >= 65) confidence = 0.94;
  else if (top1[1] >= 45) confidence = 0.86;
  else if (top1[1] >= 28) confidence = 0.74;
  else if (top1[1] >= 15) confidence = 0.62;

  confidence = Math.min(0.98, confidence + Math.min(0.25, margin / 100));

  return {
    ok: true,
    intent: best,
    confidence,
    keywords: keywords(qRaw),
    debug: { scores },
  };
}
