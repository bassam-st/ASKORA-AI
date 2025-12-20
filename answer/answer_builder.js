// answer/answer_builder.js
export function buildAnswer({
  question = "",
  intent = "",
  context = "",
  final = "",
  sources = [],
  note = "",
} = {}) {
  // ✅ تأمين: sources لازم Array
  let safeSources = [];
  if (Array.isArray(sources)) safeSources = sources;
  else if (sources && Array.isArray(sources.sources)) safeSources = sources.sources;
  else safeSources = [];

  const cleanedSources = safeSources
    .filter(Boolean)
    .map((s) => {
      if (typeof s === "string") {
        return { title: "source", link: "", content: s };
      }
      if (typeof s === "object" && s) {
        return {
          title: String(s.title || "source"),
          link: String(s.link || s.url || ""),
          content: String(s.content || s.snippet || s.text || ""),
        };
      }
      return { title: "source", link: "", content: String(s) };
    })
    .slice(0, 8); // ✅ حد أعلى

  return {
    ok: true,
    question: String(question || ""),
    intent: String(intent || ""),
    context: String(context || ""),
    answer: String(final || ""),
    sources: cleanedSources,
    note: String(note || ""),
  };
}
