// intent/intent_classifier.js
// مصنف نية ذكي (بدون نموذج) + درجة ثقة + كلمات مفتاحية
// تحسين: Intent جديد "schedule" + Booster للعبارات القصيرة (Query-style)

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

/**
 * Query-style Booster:
 * عبارات قصيرة بدون أدوات استفهام، مثل: "مباريات اليوم" "سعر الذهب" "جدول الدوري"
 * نحاول تحويلها لنية مناسبة بدل general.
 */
function applyQueryBooster({ q, ctx, scores }) {
  const raw = stripPunct(q);
  const tokens = raw.split(" ").filter(Boolean);
  const len = tokens.length;

  // أدوات استفهام/سؤال (لو موجودة نخلي القواعد الأساسية تعمل بدون تدخل قوي)
  const hasQuestionWord =
    /(^|\s)(كيف|لماذا|ليش|كم|أين|اين|ما|ماذا|من)\b/i.test(q) ||
    /\b(what|why|how|where|who|which)\b/i.test(q);

  // علامة سؤال
  const hasQuestionMark = /[?؟]/.test(q);

  // إذا جملة قصيرة + ليست سؤال صريح → Booster
  const isShortQuery = len >= 1 && len <= 4 && !hasQuestionWord && !hasQuestionMark;

  if (!isShortQuery) return;

  // 1) Schedule / Matches
  if (
    /(مباريات|مباراة|جدول|fixtures|schedule|match(es)?|results?|نتائج|ترتيب|standings|points|الدوري|الكأس)\b/i.test(q) ||
    /(اليوم|الليلة|غدا|غداً|this\s+week|today|tonight|tomorrow)\b/i.test(q)
  ) {
    scores.schedule = (scores.schedule || 0) + 45;
    scores.news = (scores.news || 0) + 8;
    return;
  }

  // 2) Prices / how_many
  if (/(سعر|اسعار|تكلفة|ثمن|price|cost)\b/i.test(q)) {
    scores.how_many = (scores.how_many || 0) + 35;
    return;
  }

  // 3) Definition-like
  if (len === 1) {
    // كلمة واحدة غالبًا "تعريف/معلومة عامة"
    scores.define = (scores.define || 0) + 18;
  }

  // 4) Tech/how if context dev
  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) {
    scores.how = (scores.how || 0) + 10;
  }
}

export function classifyIntent({ text = "", context = "" } = {}) {
  const qRaw = String(text || "").trim();
  const q = norm(qRaw);
  const ctx = norm(context);

  // قواعد (Regex + وزن)
  const RULES = {
    schedule: [
      { re: /\bمباريات\b/i, w: 35 },
      { re: /\bمباراة\b/i, w: 25 },
      { re: /\bجدول\b/i, w: 35 },
      { re: /\bنتائج\b/i, w: 28 },
      { re: /\bترتيب\b/i, w: 18 },
      { re: /\bالدوري\b/i, w: 18 },
      { re: /\bكأس\b/i, w: 14 },
      { re: /\bfixtures\b/i, w: 35 },
      { re: /\bschedule\b/i, w: 35 },
      { re: /\bmatches?\b/i, w: 30 },
      { re: /\bresults?\b/i, w: 25 },
      { re: /\bstandings\b/i, w: 20 },
      { re: /\btoday\b/i, w: 18 },
      { re: /\btonight\b/i, w: 15 },
      { re: /\btomorrow\b/i, w: 12 },
      { re: /\bاليوم\b/i, w: 15 },
      { re: /\bالليلة\b/i, w: 12 },
      { re: /\bغدا\b/i, w: 10 },
      { re: /\bغداً\b/i, w: 10 },
    ],

    who_is: [
      { re: /^(من هو|من هي|من)\b/i, w: 40 },
      { re: /\b(sir|mr|mrs|dr)\b/i, w: 10 },
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
      { re: /\bwhich\s+is\s+better\b/i, w: 25 },
    ],

    translate: [
      { re: /\bترجم\b/i, w: 35 },
      { re: /\btranslate\b/i, w: 35 },
      { re: /\bبالانجليزي\b/i, w: 20 },
      { re: /\bبالإنجليزي\b/i, w: 20 },
      { re: /\benglish\b/i, w: 12 },
      { re: /\barabic\b/i, w: 12 },
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

  // تعزيز حسب السياق (Dev/Customs)
  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) {
    scores.how += 10;
  }
  if (ctx.includes("بند") || ctx.includes("hs") || ctx.includes("جمارك")) {
    scores.how_many += 10;
    scores.define += 6;
  }

  // ✅ Booster للعبارات القصيرة
  applyQueryBooster({ q: qRaw, ctx, scores });

  // اختيار أعلى نية
  let best = "general";
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) {
      bestScore = v;
      best = k;
    }
  }

  // حساب الثقة
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top1 = sorted[0] || ["general", 0];
  const top2 = sorted[1] || ["general", 0];

  const margin = Math.max(0, top1[1] - top2[1]);
  let confidence = 0.35;

  if (top1[1] >= 55) confidence = 0.93;
  else if (top1[1] >= 45) confidence = 0.88;
  else if (top1[1] >= 35) confidence = 0.80;
  else if (top1[1] >= 25) confidence = 0.70;
  else if (top1[1] >= 15) confidence = 0.60;
  else confidence = 0.45;

  confidence = Math.min(0.98, confidence + Math.min(0.25, margin / 120));

  return {
    ok: true,
    intent: best,
    confidence,
    keywords: keywords(qRaw),
    debug: { scores },
  };
}
