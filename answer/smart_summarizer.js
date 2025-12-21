// answer/smart_summarizer.js
// Smart Summarizer - Level 3 (ChatGPT-like, no LLM)
// Priority: Intelligence > Speed > Accuracy
// Builds a natural, friendly answer from web sources

// ---------------- Utilities ----------------
function cleanText(s = "") {
  return String(s || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\uFFFD/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectArabic(s = "") {
  return /[ء-ي]/.test(s);
}

function splitSentences(text = "") {
  const t = cleanText(text);
  if (!t) return [];
  return t
    .split(/(?<=[\.\!\?\u061F\u06D4])\s+|[\n•\-]+/g)
    .map(x => cleanText(x))
    .filter(x => x.length >= 25);
}

function tokenize(s = "") {
  const t = cleanText(s).toLowerCase();
  const raw = t.split(/[^a-z0-9\u0600-\u06FF]+/g).filter(Boolean);

  const stop = new Set([
    "في","من","على","الى","إلى","عن","هو","هي","هذا","هذه","ذلك","تلك","ما","ماذا","كيف","كم","أين","اين",
    "the","a","an","is","are","of","to","in","on","for","and","or","with","by","as"
  ]);

  return raw.filter(w => w.length >= 2 && !stop.has(w));
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

// ---------------- Core Logic ----------------
function extractCandidates(question, sources) {
  const qTok = tokenize(question);
  const pool = [];

  for (const s of sources) {
    const title = cleanText(s?.title || "");
    const content = cleanText(s?.content || "");

    const sentences = splitSentences(`${title}. ${content}`);
    for (const sent of sentences) {
      const score =
        jaccard(tokenize(sent), qTok) +
        (title ? 0.05 : 0) +
        (sent.length > 80 ? 0.05 : 0);

      pool.push({ sent, score });
    }
  }

  pool.sort((a, b) => b.score - a.score);

  // إزالة الجمل المتشابهة
  const picked = [];
  for (const item of pool) {
    if (picked.length >= 10) break;
    const similar = picked.some(p => jaccard(tokenize(p.sent), tokenize(item.sent)) > 0.82);
    if (!similar) picked.push(item);
  }

  return picked;
}

function buildIntro(question, intent, best) {
  if (!best.length) return "";

  const first = best[0].sent;
  const isAr = detectArabic(question);

  // صياغة ودودة
  if (intent?.main_intent === "geography") {
    return isAr
      ? `باختصار، ${first}`
      : `In short, ${first}`;
  }

  if (intent?.main_intent === "person") {
    return isAr
      ? `بشكل عام، ${first}`
      : `Generally, ${first}`;
  }

  return isAr
    ? `إليك خلاصة واضحة عن سؤالك: ${first}`
    : `Here is a clear summary of your question: ${first}`;
}

function buildBullets(best) {
  return best
    .slice(1, 6)
    .map(x => "• " + cleanText(x.sent))
    .filter(Boolean);
}

function qualityNote(best, sources) {
  if (!sources.length) {
    return "لم أتمكن من العثور على مصادر الآن (قد تكون مفاتيح البحث غير مفعلة).";
  }
  if (!best.length) {
    return "وجدت مصادر، لكن المعلومات المتاحة كانت محدودة. يمكنك إعادة صياغة السؤال.";
  }
  if (best[0].score < 0.08) {
    return "المعلومات المتاحة قد لا تكون دقيقة تمامًا لأن تطابقها مع سؤالك ضعيف.";
  }
  return "";
}

// ---------------- Public API ----------------
export function smartSummarize({ question = "", intent = {}, sources = [] } = {}) {
  const q = cleanText(question);
  const src = Array.isArray(sources) ? sources : [];

  if (!q) return "السؤال فارغ.";
  if (!src.length) return "لم أجد نتائج كافية للإجابة الآن.";

  const best = extractCandidates(q, src);

  const intro = buildIntro(q, intent, best);
  const bullets = buildBullets(best);
  const note = qualityNote(best, src);

  let answer = "";

  if (intro) {
    answer += intro;
  }

  if (bullets.length) {
    answer += "\n\n" + (detectArabic(q) ? "أهم النقاط:" : "Key points:");
    answer += "\n" + bullets.join("\n");
  }

  if (note) {
    answer += "\n\nملاحظة: " + note;
  }

  return answer.trim();
}
