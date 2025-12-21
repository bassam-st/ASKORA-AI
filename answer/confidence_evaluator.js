// answer/confidence_evaluator.js — VINFINITY
function host(url=""){
  try{ return new URL(url).hostname.replace(/^www\./,"").toLowerCase(); }
  catch{ return ""; }
}

export function evaluateConfidence({ intent="general", intentConfidence=0.55, sources=[] } = {}) {
  const src = Array.isArray(sources) ? sources : [];
  const n = src.length;

  let score = 0.30 + (Number(intentConfidence || 0.55) * 0.40);

  if (n >= 1) score += 0.08;
  if (n >= 3) score += 0.10;
  if (n >= 5) score += 0.10;

  if (intent === "schedule") {
    const good = src.some(s => {
      const h = host(s?.link || "");
      return (
        h.endsWith("yallakora.com") ||
        h.endsWith("koora.com") ||
        h.endsWith("filgoal.com") ||
        h.endsWith("365scores.com") ||
        h.endsWith("sofascore.com")
      );
    });
    if (good) score += 0.18;
  }

  score = Math.max(0.15, Math.min(0.95, score));
  const level = score >= 0.78 ? "high" : score >= 0.56 ? "medium" : "low";
  return { score, level };
}
