// answer/smart_summarizer.js
// Smart Summarizer (Level 2) - بدون نموذج
// الهدف: يعطي جواب مختصر + نقاط مهمة + يعتمد على أفضل snippets من الويب
// مدخلاته: { question, intent, sources } حيث sources: [{title, content, link}]

function cleanText(s = "") {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")        // إزالة HTML لو موجود
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text = "") {
  const t = cleanText(text);
  if (!t) return [];
  // تقسيم عربي/إنجليزي بسيط
  return t
    .split(/(?<=[\.\!\?\u061F\u06D4])\s+|[\n•\-]+/g)
    .map((x) => cleanText(x))
    .filter((x) => x.length >= 20);
}

function tokenize(s = "") {
  const t = cleanText(s).toLowerCase();
  // كلمات بدون رموز
  const raw = t.split(/[^a-z0-9\u0600-\u06FF]+/g).filter(Boolean);

  // كلمات توقف بسيطة (عربي/إنجليزي)
  const stop = new Set([
    "في","من","على","الى","إلى","عن","هو","هي","هذا","هذه","ذلك","تلك","ما","ماذا","كيف","كم","أين","اين",
    "the","a","an","is","are","of","to","in","on","for","and","or","with","by","as"
  ]);

  return raw.filter(w => w.length >= 2 && !stop.has(w));
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function uniqByNormalized(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = cleanText(x).toLowerCase();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

function pickBestSentences(question, sources) {
  const qTok = tokenize(question);

  // اجمع جمل من كل مصدر
  const pool = [];
  for (const s of sources) {
    const title = cleanText(s?.title || "");
    const content = cleanText(s?.content || "");
    const link = cleanText(s?.link || "");

    const sentences = splitSentences(`${title}. ${content}`);
    for (const sent of sentences) {
      const score =
        jaccard(tokenize(sent), qTok) +
        (title ? 0.05 : 0) +
        (link ? 0.03 : 0);

      pool.push({ sent, score, link, title });
    }
  }

  // ترتيب حسب الأفضل
  pool.sort((a, b) => (b.score - a.score));

  // إزالة تكرار الجمل المتشابهة
  const picked = [];
  for (const item of pool) {
    if (picked.length >= 8) break;
    const tooSimilar = picked.some(p => jaccard(tokenize(p.sent), tokenize(item.sent)) > 0.82);
    if (tooSimilar) continue;
    picked.push(item);
  }

  return picked;
}

function inferShortAnswer(question, best) {
  // لو في جملة قوية جدًا، خذ منها "جواب مختصر"
  if (!best.length) return "";

  // أفضل جملة
  const top = best[0].sent;

  // قص ذكي: إذا طويلة، نأخذ أول 220 حرف تقريبًا
  const t = cleanText(top);
  if (t.length <= 220) return t;

  // قص على أقرب فاصلة/نقطة
  const cut = t.slice(0, 220);
  const idx = Math.max(cut.lastIndexOf("،"), cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("؟"));
  return (idx > 80 ? cut.slice(0, idx + 1) : cut) + "…";
}

function makeBullets(best) {
  const bullets = best
    .slice(0, 5)
    .map((x) => "• " + cleanText(x.sent))
    .filter(Boolean);

  return uniqByNormalized(bullets).slice(0, 5);
}

function qualityNote(best, sources) {
  const n = Array.isArray(sources) ? sources.length : 0;
  if (n === 0) return "لم أجد مصادر الآن (قد تكون مفاتيح Google CSE غير مفعلة).";
  if (!best.length) return "وجدت مصادر لكن النصوص قصيرة/ضعيفة للتلخيص. جرّب صياغة ثانية.";
  if (best[0].score < 0.08) return "النتائج قد لا تكون دقيقة تمامًا لأن تطابقها مع سؤالك ضعيف.";
  return "";
}

function formatByIntent(intent, shortAnswer, bullets) {
  // قوالب بسيطة حسب intent
  const it = String(intent || "general").toLowerCase();

  if (it === "definition" || it === "general") {
    let out = "";
    if (shortAnswer) out += shortAnswer + "\n\n";
    if (bullets?.length) out += "أهم النقاط:\n" + bullets.join("\n");
    return out.trim();
  }

  if (it === "howto") {
    let out = "";
    if (shortAnswer) out += shortAnswer + "\n\n";
    if (bullets?.length) out += "خطوات/نقاط عملية:\n" + bullets.join("\n");
    return out.trim();
  }

  if (it === "compare") {
    let out = "";
    if (shortAnswer) out += shortAnswer + "\n\n";
    if (bullets?.length) out += "مقارنة مختصرة:\n" + bullets.join("\n");
    return out.trim();
  }

  // default
  let out = "";
  if (shortAnswer) out += shortAnswer + "\n\n";
  if (bullets?.length) out += "ملخص:\n" + bullets.join("\n");
  return out.trim();
}

export function smartSummarize({ question = "", intent = "general", sources = [] } = {}) {
  const q = cleanText(question);
  const src = Array.isArray(sources) ? sources : [];

  if (!q) return "السؤال فارغ.";
  if (!src.length) return "لم أجد نتائج بحث الآن. تأكد من تفعيل مفاتيح Google CSE في Vercel.";

  const best = pickBestSentences(q, src);
  const shortAnswer = inferShortAnswer(q, best);
  const bullets = makeBullets(best);

  const note = qualityNote(best, src);

  let finalText = formatByIntent(intent, shortAnswer, bullets);

  if (!finalText) {
    // fallback نهائي
    finalText = "ملخص سريع:\n" + (bullets.length ? bullets.join("\n") : "لا توجد نقاط كافية.");
  }

  if (note) finalText += `\n\nملاحظة: ${note}`;

  return finalText.trim();
}
