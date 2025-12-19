export function buildAnswer({ question, intent, context, sourceData }) {
  return `
السؤال:
${question}

النية:
${intent}

السياق:
${context}

الإجابة:
${sourceData}

— ASKORA AI
  `;
}
