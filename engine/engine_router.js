import { webSearch } from "../tools/web_search.js";
import { buildAnswer } from "../answer/answer_builder.js";

export async function routeEngine({ text, intent, context }) {
  let sourceData = "";

  if (intent === "news" || intent === "general_search") {
    sourceData = await webSearch(text);
  } else {
    sourceData = "هذه إجابة معرفية عامة بناءً على التحليل.";
  }

  return buildAnswer({
    question: text,
    intent,
    context,
    sourceData
  });
}
