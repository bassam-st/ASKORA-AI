// intent/intent_classifier.js
// Intent Classifier v2.1
// ✅ يفهم "مباريات اليوم" حتى مع أخطاء إملائية/زيادة/نقص
// ✅ يرجّح schedule بثقة عالية

function norm(s = "") {
  return String(s || "")
    .toLowerCase()
    .replace(/\uFFFD/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTashkeel(s = "") {
  return String(s || "")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "");
}

function simplifyArabic(s = "") {
  // تطبيع عربي قوي
  return stripTashkeel(s)
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

function keywords(question = "") {
  const t = norm(question);
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

// تشابه بسيط بين كلمتين (يدعم أخطاء حرف/حرفين)
function fuzzyIncludes(text, needle) {
  const t = simplifyArabic(norm(text));
  const n = simplifyArabic(norm(needle));
  if (!t || !n) return false;
  if (t.includes(n)) return true;

  // لو الكلمة قصيرة جدًا، لا نعمل fuzzy قوي
  if (n.length <= 3) return false;

  // match تقريبي: وجود معظم الحروف بالترتيب
  let i = 0;
  for (let j = 0; j < t.length && i < n.length; j++) {
    if (t[j] === n[i]) i++;
  }
  // لو تم التقاط >= 80% من أحرف النية نعتبرها موجودة
  return i / n.length >= 0.8;
}

function isScheduleQuery(qRaw = "") {
  const q = String(qRaw || "");

  // عربي/إنجليزي
  const strong =
    fuzzyIncludes(q, "مباريات") ||
    fuzzyIncludes(q, "مباراة") ||
    fuzzyIncludes(q, "جدول") ||
    fuzzyIncludes(q, "نتائج") ||
    fuzzyIncludes(q, "ترتيب") ||
    /fixtures|schedule|match|matches|results|standings|points/i.test(q);

  // “اليوم” + كرة/دوري… تعزز
  const booster =
    fuzzyIncludes(q, "اليوم") ||
    fuzzyIncludes(q, "كرة") ||
    fuzzyIncludes(q, "الدوري") ||
    fuzzyIncludes(q, "كاس") ||
    /today|tonight/i.test(q);

  return strong || booster;
}

function scoreMatch(text, rules) {
  let score = 0;
  for (const r of rules) {
    if (r.re.test(text)) score += r.w;
  }
  return score;
}

export function classifyIntent({ text = "", context = "" } = {}) {
  const qRaw = String(text || "").trim();
  const q = norm(qRaw);
  const ctx = norm(context);

  // ✅ Hard override: مباريات = schedule
  if (isScheduleQuery(qRaw)) {
    return {
      ok: true,
      intent: "schedule",
      confidence: 0.97,
      keywords: keywords(qRaw),
      debug: { forced: "schedule_fuzzy" },
    };
  }

  const RULES = {
    define: [
      { re: /^(ما هو|ما هي|ما معنى|اشرح|عرّف|عرف)\b/i, w: 40 },
      { re: /\bwhat\s+is\b/i, w: 40 },
    ],
    where: [
      { re: /^(أين|اين)\b/i, w: 45 },
      { re: /\bwhere\b/i, w: 45 },
    ],
    how: [
      { re: /^(كيف)\b/i, w: 40 },
      { re: /\bhow\b/i, w: 40 },
      { re: /\bطريقة\b/i, w: 15 },
      { re: /\bخطوات\b/i, w: 15 },
    ],
    how_many: [
      { re: /\bكم\b/i, w: 35 },
      { re: /\bhow\s+many\b/i, w: 40 },
      { re: /\bhow\s+much\b/i, w: 35 },
      { re: /\bسعر\b/i, w: 15 },
      { re: /\bتكلفة\b/i, w: 15 },
    ],
    news: [
      { re: /\bآخر الأخبار\b/i, w: 25 },
      { re: /\bاخبار\b/i, w: 20 },
      { re: /\bnews\b/i, w: 25 },
    ],
    general: [{ re: /.*/i, w: 1 }],
  };

  const scores = {};
  for (const k of Object.keys(RULES)) scores[k] = scoreMatch(q, RULES[k]);

  if (ctx.includes("vercel") || ctx.includes("github") || ctx.includes("deploy")) scores.how += 10;

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
  if (top1[1] >= 40) confidence = 0.85;
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
