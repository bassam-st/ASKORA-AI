// answer/confidence_evaluator.js
// Answer Confidence Evaluator
// Outputs score (0-1), level, and human-readable reason

function clamp(n, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function scoreSources(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return 0;

  let score = 0;
  const strongDomains = [
    "wikipedia.org","britannica.com",
    "un.org","who.int","unicef.org",
    "worldbank.org","imf.org","oecd.org",
    "cia.gov","state.gov","gov"
  ];

  for (const s of sources) {
    if (!s?.link) continue;
    if (strongDomains.some(d => s.link.includes(d))) score += 0.15;
    else score += 0.05;
  }

  return clamp(score, 0, 0.6);
}

function scoreContentLength(answer = "") {
  const len = String(answer || "").length;
  if (len > 400) return 0.2;
  if (len > 200) return 0.15;
  if (len > 80) return 0.1;
  return 0.05;
}

function scoreIntent(intent = {}) {
  if (!intent || typeof intent !== "object") return 0.05;
  return clamp(Number(intent.confidence || 0.5) * 0.25, 0, 0.25);
}

function levelFromScore(score) {
  if (score >= 0.8) return "عالية";
  if (score >= 0.55) return "متوسطة";
  return "منخفضة";
}

function reasonFrom(score, sources, intent) {
  if (score >= 0.8) {
    return "مصادر قوية ومتعددة مع تطابق جيد جدًا مع السؤال.";
  }
  if (score >= 0.55) {
    return "المصادر متوفرة لكن قوتها أو تطابقها متوسط.";
  }
  return "المعلومات محدودة أو المصادر ضعيفة نسبيًا.";
}

export function evaluateConfidence({ answer, sources, intent }) {
  let score = 0;

  score += scoreSources(sources);
  score += scoreContentLength(answer);
  score += scoreIntent(intent);

  score = clamp(score);

  return {
    score: Number(score.toFixed(2)),
    level: levelFromScore(score),
    reason: reasonFrom(score, sources, intent),
  };
}
