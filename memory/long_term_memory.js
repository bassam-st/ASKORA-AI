const memory = [];

export function saveToMemory(question, answer) {
  memory.push({ question, answer, time: Date.now() });
}

export function searchMemory(text) {
  return memory.find(m => m.question.includes(text));
}
