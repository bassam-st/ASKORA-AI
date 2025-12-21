// intent/intent_classifier.js
// مصنف نية ذكي (بدون نموذج) + درجة ثقة + كلمات مفتاحية
// تطوير: تطبيع عربي أقوى + نيات إضافية (customs/deploy) + ثقة أدق + debug اختياري

function stripDiacritics(s = "") {
  // إزالة التشكيل العربي
  return String(s).replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

function normalizeArabic(s = "") {
  // توحيد أشكال الحروف العربية لتقليل اختلاف الكتابة
  return String(s)
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, ""); // مدّ
}

function norm(s = "") {
  return normalizeArabic(
    stripDiacritics(
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\uFFFD/g, "")
    )
  )
    .replace(/\s+/g, " ")
    .trim();
}

function stripPunct(s = "") {
  // إبقاء الحروف والأرقام والمسافات فقط
  return String(s || "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  const t = stripPunct(norm(text));
  if (!t) return [];
  return t.split(" ").filter(Boolean);
}

function keywords(question = "") {
  const parts = tokenize(question);

  const stop = new Set([
    // عربي
    "في","على","من","الى","الي","عن","ما","ماذا","هل","كم","كيف","لماذا","ليش","اين","وين",
    "هذا","هذه","هذي","ذلك","تلك","هناك","هنا","انا","انت","انتي","هو","هي","هم","هن",
    "مع","او","و","ثم","بعد","قبل","اذا","إن","لان","لانه","لكن","يعني","تمام","طيب",
    // EN
    "the","a","an","is","are","of","to","in","on","for","and","or","what","who","where","how","why",
  ]);

  const out = [];
  for (const w of parts) {
    if (w.length < 2) continue;
    if (stop.has(w)) continue;
    // تجاهل أرقام قصيرة جدًا
    if (/^\d{1,2}$/.test(w)) continue;
    out.push(w);
  }

  // إزالة تكرار
  const uniq = [];
  const seen = new Set();
  for (const w of out) {
    if (seen.has(w)) continue;
    seen.add(w);
    uniq.push(w);
  }

  return uniq.slice(0, 12);
}

function scoreMatch(text, rules) {
  let score = 0;
  for (const r of rules) {
    if (r.re.test(text)) score += r.w;
  }
  return score;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

/**
 * classifyIntent
 * @param {Object} args
 * @param {string} args.text
 * @param {string} args.context
 * @param {Object} opts
 * @param {boolean} opts.debug
 */
export function classifyIntent({ text = "", context = "" } = {}, opts = {}) {
  const qRaw = String(text || "").trim();
  const q = norm(qRaw);
  const ctx = norm(context);

  // قواعد (Regex + وزن)
  // ملاحظة: نرتّب النيات الأكثر تحديداً قبل العامة
  const RULES = {
    // 🔧 نشر/ديبلوي/أخطاء سيرفر/فيركل/جيت
    deploy: [
      { re: /\b(vercel|github|deploy|deployment|build|logs?|runtime|api\/|500|404|cors)\b/i, w: 35 },
      { re: /\b(نشر|ديبلوي|فيركل|فركل|جيت|جيتهاب|اكشنز|actions|build|logs|سجلات|اخطاء|خطا|سيرفر)\b/i, w: 35 },
      { re: /\b(لماذا\s+لا\s+يعمل|ما\s+المشكله|ما\s+هذا\s+الخطا)\b/i, w: 20 },
    ],

    // 🧾 جمارك/HS/بند
    customs: [
      { re: /\b(hs|hs\s*code|harmonized|tariff|customs)\b/i, w: 35 },
      { re: /\b(بند|التعرفة|تعرفه|جمارك|رسوم|اسكودا|اسيكودا|as ycuda|asycuda)\b/i, w: 35 },
      { re: /\b(كم\s+بند|رقم\s+البند|hs\s*[:\-]?\s*\d+)/i, w: 25 },
    ],

    translate: [
      { re: /\bترجم\b/i, w: 40 },
      { re: /\btranslate\b/i, w: 40 },
      { re: /\bبالانجليزي\b/i, w: 25 },
      { re: /\benglish\b/i, w: 15 },
      { re: /\barabic\b/i, w: 12 },
    ],

    summarize: [
      { re: /\bتلخيص\b/i, w: 40 },
      { re: /\bsummary\b/i, w: 40 },
      { re: /\bsummarize\b/i, w: 40 },
      { re: /\bاختصر\b/i, w: 28 },
    ],

    news: [
      { re: /\bاخر\s+الاخبار\b/i, w: 30 },
      { re: /\bاخبار\b/i, w: 22 },
      { re: /\bnews\b/i, w: 30 },
      { re: /\bbreaking\b/i, w: 18 },
    ],

    // أسئلة الأشخاص
    who_is: [
      { re: /^(من\s+هو|من\s+هي|من)\b/i, w: 45 },
      { re: /\bwho\s+is\b/i, w: 45 },
      { re: /\b(sir|mr|mrs|dr)\b/i, w: 10 },
    ],

    define: [
      { re: /^(ما\s+هو|ما\s+هي|ما\s+معنى|اشرح|عرف|تعريف)\b/i, w: 42 },
      { re: /\bwhat\s+is\b/i, w: 42 },
      { re: /\bmeaning\b/i, w: 15 },
      { re: /\bdefinition\b/i, w: 15 },
    ],

    where: [
      { re: /^(اين|اين)\b/i, w: 45 },
      { re: /\bwhere\b/i, w: 45 },
      { re: /\bموقع\b/i, w: 18 },
      { re: /\bيقع\b/i, w: 15 },
    ],

    how: [
      { re: /^(كيف)\b/i, w: 42 },
      { re: /\bhow\b/i, w: 42 },
      { re: /\bطريقة\b/i, w: 18 },
      { re: /\bخطوات\b/i, w: 18 },
      { re: /\bsetup\b/i, w: 14 },
      { re: /\binstall\b/i, w: 14 },
      { re: /\bconfigure\b/i, w: 14 },
    ],

    why: [
      { re: /^(لماذا|ليش)\b/i, w: 45 },
      { re: /\bwhy\b/i, w: 45 },
      { re: /\bسبب\b/i, w: 15 },
    ],

    how_many: [
      { re: /\bكم\b/i, w: 28 },
      { re: /\bhow\s+many\b/i, w: 40 },
      { re: /\bhow\s+much\b/i, w: 35 },
      { re: /\bعدد\b/i, w: 14 },
      { re: /\bسعر\b/i, w: 18 },
      { re: /\bتكلفه\b/i, w: 18 },
      { re: /\bprice\b/i, w: 14 },
      { re: /\bcost\b/i, w: 14 },
    ],

    compare: [
      { re: /\bالفرق\b/i, w: 28 },
      { re: /\bقارن\b/i, w: 28 },
      { re: /\bافضل\b/i, w: 18 },
      { re: /\bvs\b/i, w: 22 },
      { re: /\bcompare\b/i, w: 28 },
      { re: /\bdifference\b/i, w: 28 },
      { re: /\bwhich\s+is\s+better\b/i, w: 28 },
    ],

    general: [{ re: /.*/i, w: 1 }],
  };

  const scores = {};
  for (const k of Object.keys(RULES)) {
    scores[k] = scoreMatch(q, RULES[k]);
  }

  // تعزيز حسب السياق
  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) {
    scores.deploy += 12;
    scores.how += 6;
  }
  if (ctx.includes("بند") || ctx.includes("hs") || ctx.includes("جمارك") || ctx.includes("اسكودا") || ctx.includes("اسيكودا")) {
    scores.customs += 12;
    scores.how_many += 6;
    scores.define += 4;
  }

  // تعزيز ذكي من الكلمات المفتاحية
  const kws = keywords(qRaw).join(" ");
  if (/\b(vercel|deploy|github|logs|api)\b/i.test(kws)) scores.deploy += 10;
  if (/\b(hs|بند|جمارك|تعرفه|tariff|customs)\b/i.test(kws)) scores.customs += 10;

  // اختيار أعلى نية
  let best = "general";
  let bestScore = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) {
      bestScore = v;
      best = k;
    }
  }

  // حساب الثقة (0..1)
  // الثقة تعتمد على:
  // - قوة النية
  // - الفارق عن ثاني نية
  // - طول السؤال (السؤال القصير جداً يقلل الثقة عادة)
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const top1 = sorted[0] || ["general", 0];
  const top2 = sorted[1] || ["general", 0];

  const margin = Math.max(0, top1[1] - top2[1]);
  const len = tokenize(qRaw).length;

  let confidence;
  const s = top1[1];

  if (s >= 55) confidence = 0.92;
  else if (s >= 45) confidence = 0.86;
  else if (s >= 35) confidence = 0.78;
  else if (s >= 25) confidence = 0.68;
  else if (s >= 15) confidence = 0.58;
  else confidence = 0.46;

  // الفارق يزيد الثقة
  confidence += clamp(margin / 120, 0, 0.22);

  // طول السؤال: إذا أقل من 2 كلمات خفّض الثقة قليل
  if (len <= 1) confidence -= 0.12;
  else if (len === 2) confidence -= 0.06;

  confidence = clamp(confidence, 0.35, 0.98);

  const result = {
    ok: true,
    intent: best,
    confidence,
    keywords: keywords(qRaw),
  };

  // debug اختياري فقط
  if (opts && opts.debug) {
    result.debug = { scores, q, ctx, top1, top2, margin, len };
  }

  return result;
}
