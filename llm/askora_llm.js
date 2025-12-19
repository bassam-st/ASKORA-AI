// llm/askora_llm.js
import { geminiGenerate } from "./gemini_client.js";

export async function askoraLLM({
  question,
  intent,
  context,
  sources = [],
}) {
  const system = `
أنت ASKORA، مساعد ذكي يتحدث العربية بوضوح.
مهمتك: الإجابة بدقة وباختصار، اعتمادًا على "المصادر" إن وُجدت.
إن كانت المصادر غير كافية قل ذلك بصراحة واقترح ماذا يحتاج المستخدم.
لا تخترع حقائق.
إذا كانت هناك أرقام/أسعار/أخبار حديثة: نبّه أنها تتغير وتحتاج تحقق.
`.trim();

  const sourcesText = sources
    .slice(0, 5)
    .map((s, i) => `[#${i + 1}] ${s.title}\n${s.content}`)
    .join("\n\n");

  const prompt = `
السؤال: ${question}
النية: ${intent || "unknown"}

السياق السابق (إن وجد):
${context || "(empty)"}

مصادر (قد تكون ملخصات):
${sourcesText || "(no sources)"}

اكتب الإجابة النهائية بالعربية بصياغة طبيعية.
- إذا استخدمت معلومة من مصدر، ضع في نهاية الجملة: [#رقم]
- اجعل الإجابة مرتبة بنقاط عند الحاجة.
`.trim();

  const out = await geminiGenerate({
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    system,
    prompt,
    temperature: 0.35,
    maxOutputTokens: 800,
  });

  return out;
}
