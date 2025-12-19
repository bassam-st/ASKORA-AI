export function classifyIntent(text) {
  if (!text) return "unknown";

  if (text.includes("كيف") || text.includes("ما هو"))
    return "explain";

  if (text.includes("قارن") || text.includes("افضل"))
    return "compare";

  if (text.includes("سعر") || text.includes("كم"))
    return "price";

  if (text.includes("اخبار") || text.includes("اليوم"))
    return "news";

  return "general_search";
}
