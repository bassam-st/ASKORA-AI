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
  else if (Array.isArray(sources?.sources)) safeSources = sources.sources;
  else safeSources = [];

  const cleanedSources = safeSources.map((s) => {
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
    question,
    intent,
    context,
    answer: final,
    sources: cleanedSources,
    note,
  };
}
