// intent/intent_classifier.js
// مصنف نية ذكي (بدون نموذج) + درجة ثقة + كلمات مفتاحية
// ✅ تعديل قوي: Hard override لنية schedule عند وجود كلمات مباريات/جدول/نتائج...

function norm(s = "") {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ");
}

function stripPunct(s = "") {
  return String(s || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywords(question = "") {
  const t = stripPunct(norm(question));
  if (!t) return [];
  const parts = t.split(" ").filter(Boolean);

  const stop = new Set([
    "في","على","من","الى","إلى","عن","ما","ماذا","هل","كم","كيف","لماذا","ليش","أين","اين",
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

function scoreMatch(text, rules) {
  let score = 0;
  for (const r of rules) {
    if (r.re.test(text)) score += r.w;
  }
  return score;
}

function isScheduleQuery(q = "") {
  // كلمات مؤكدة للمباريات/الجدول/النتائج
  return /(مباريات|مباراة|جدول|نتائج|ترتيب|الدوري|كأس|fixtures|schedule|match(es)?|results?|standings|points)\b/i.test(q);
}

export function classifyIntent({ text = "", context = "" } = {}) {
  const qRaw = String(text || "").trim();
  const q = norm(qRaw);
  const ctx = norm(context);

  // ✅ Hard override: أي ذكر للمباريات/الجدول = schedule فوراً
  if (isScheduleQuery(qRaw)) {
    return {
      ok: true,
      intent: "schedule",
      confidence: 0.95,
      keywords: keywords(qRaw),
      debug: { forced: "schedule" },
    };
  }

  const RULES = {
    who_is: [
      { re: /^(من هو|من هي|من)\b/i, w: 40 },
      { re: /\bwho\s+is\b/i, w: 40 },
    ],
    define: [
      { re: /^(ما هو|ما هي|ما معنى|اشرح|عرّف|عرف)\b/i, w: 40 },
      { re: /\bwhat\s+is\b/i, w: 40 },
      { re: /\bmeaning\b/i, w: 15 },
      { re: /\bdefinition\b/i, w: 15 },
    ],
    where: [
      { re: /^(أين|اين)\b/i, w: 45 },
      { re: /\bwhere\b/i, w: 45 },
      { re: /\bموقع\b/i, w: 15 },
      { re: /\bيقع\b/i, w: 12 },
    ],
    how: [
      { re: /^(كيف)\b/i, w: 40 },
      { re: /\bhow\b/i, w: 40 },
      { re: /\bطريقة\b/i, w: 15 },
      { re: /\bخطوات\b/i, w: 15 },
      { re: /\bsetup\b/i, w: 12 },
      { re: /\binstall\b/i, w: 12 },
      { re: /\bconfigure\b/i, w: 12 },
    ],
    why: [
      { re: /^(لماذا|ليش)\b/i, w: 45 },
      { re: /\bwhy\b/i, w: 45 },
      { re: /\bسبب\b/i, w: 12 },
    ],
    how_many: [
      { re: /\bكم\b/i, w: 35 },
      { re: /\bhow\s+many\b/i, w: 40 },
      { re: /\bhow\s+much\b/i, w: 35 },
      { re: /\bعدد\b/i, w: 12 },
      { re: /\bسعر\b/i, w: 15 },
      { re: /\bتكلفة\b/i, w: 15 },
      { re: /\bprice\b/i, w: 12 },
      { re: /\bcost\b/i, w: 12 },
    ],
    compare: [
      { re: /\bالفرق\b/i, w: 25 },
      { re: /\bقارن\b/i, w: 25 },
      { re: /\bأفضل\b/i, w: 15 },
      { re: /\bvs\b/i, w: 20 },
      { re: /\bcompare\b/i, w: 25 },
      { re: /\bdifference\b/i, w: 25 },
    ],
    translate: [
      { re: /\bترجم\b/i, w: 35 },
      { re: /\btranslate\b/i, w: 35 },
      { re: /\bبالانجليزي\b/i, w: 20 },
      { re: /\bبالإنجليزي\b/i, w: 20 },
    ],
    summarize: [
      { re: /\bتلخيص\b/i, w: 35 },
      { re: /\bsummary\b/i, w: 35 },
      { re: /\bsummarize\b/i, w: 35 },
      { re: /\bاختصر\b/i, w: 25 },
    ],
    news: [
      { re: /\bآخر الأخبار\b/i, w: 25 },
      { re: /\bاخبار\b/i, w: 20 },
      { re: /\bnews\b/i, w: 25 },
      { re: /\bbreaking\b/i, w: 18 },
    ],
    general: [{ re: /.*/i, w: 1 }],
  };

  const scores = {};
  for (const k of Object.keys(RULES)) {
    scores[k] = scoreMatch(q, RULES[k]);
  }

  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) {
    scores.how += 10;
  }
  if (ctx.includes("بند") || ctx.includes("hs") || ctx.includes("جمارك")) {
    scores.how_many += 10;
    scores.define += 6;
  }

  let best = "general";
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) {
      bestScore = v;
      best = k;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top1 = sorted[0] || ["general", 0];
  const top2 = sorted[1] || ["general", 0];

  const margin = Math.max(0, top1[1] - top2[1]);
  let confidence = 0.45;

  if (top1[1] >= 45) confidence = 0.9;
  else if (top1[1] >= 35) confidence = 0.8;
  else if (top1[1] >= 25) confidence = 0.7;
  else if (top1[1] >= 15) confidence = 0.6;

  confidence = Math.min(0.98, confidence + Math.min(0.25, margin / 120));

  return {
    ok: true,
    intent: best,
    confidence,
    keywords: keywords(qRaw),
    debug: { scores },
  };
}
