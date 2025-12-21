// answer/answer_builder.js
export function buildAnswer({
  question = "",
  intent = "",
  context = "",
  final = "",
  sources = [],
  note = "",
  confidence = null,
} = {}) {
  let safeSources = [];
  if (Array.isArray(sources)) safeSources = sources;
  else if (Array.isArray(sources?.sources)) safeSources = sources.sources;

  const cleanedSources = safeSources
    .filter(Boolean)
    .map((s) => {
      if (typeof s === "string") return { title: "source", link: "", content: s };
      if (typeof s === "object" && s) {
        return {
          title: String(s.title || "source"),
          link: String(s.link || ""),
          content: String(s.content || ""),
        };
      }
      return { title: "source", link: "", content: String(s) };
    });

  return {
    ok: true,
    question: String(question || ""),
    intent,
    context,
    answer: String(final || ""),
    sources: cleanedSources,
    note: String(note || ""),
    confidence,
  };
}
