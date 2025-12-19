// answer/answer_builder.js
export function buildAnswer({ question, intent, context, final = "", sources = [], note = "" }) {
  const srcText = sources
    .map((s, idx) => `(${idx + 1}) ${s.title}\n${s.content}`)
    .join("\n\n");

  return `
ASKORA – AI Assistant

Question:
${question}

Intent:
${intent}

Context:
${context || "(empty)"}

Final Answer:
${final || "(empty)"}

Sources:
${srcText || "(none)"}

Note:
${note}
`.trim();
}
