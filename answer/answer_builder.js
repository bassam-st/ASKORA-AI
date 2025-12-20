// answer/answer_builder.js

export function buildAnswer({
  question = "",
  intent = "",
  context = "",
  final = "",
  sources = [],
  note = "",
}) {
  // ✅ حماية مطلقة: sources لازم يكون Array
  let safeSources = [];

  if (Array.isArray(sources)) {
    safeSources = sources;
  } else if (Array.isArray(sources?.sources)) {
    safeSources = sources.sources;
  } else {
    safeSources = [];
  }

  // تنظيف المصادر (نص فقط)
  const cleanedSources = safeSources.map((s) => {
    if (typeof s === "string") return s;
    if (typeof s === "object") {
      return s.title || s.content || JSON.stringify(s);
    }
    return String(s);
  });

  return {
    ok: true,
    question,
    intent,
    context,
    answer: final,
    sources: cleanedSources,
    note,
  };
}
