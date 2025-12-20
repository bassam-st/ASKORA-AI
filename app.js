import { normalizeInput } from "./input/input_normalizer.js";
import { classifyIntent } from "./intent/intent_classifier.js";
import { getSessionContext } from "./memory/session_memory.js";
import { routeEngine } from "./engine/engine_router.js";

// ✅ هذه هي الدالة التي ستستخدمها Vercel
export async function handleAskora(userInput) {
  const clean = normalizeInput(userInput || "");
  const intent = classifyIntent(clean);
  const context = getSessionContext(clean);

  const answer = await routeEngine({
    text: clean,
    intent,
    context,
  });

  // لازم نرجّع النص بدل ما نطبعه
  return answer;
}

/**
 * (اختياري) تشغيل محلي من Node فقط
 * على Vercel هذا القسم لن يشتغل لأنه ليس هناك terminal
 */
if (process?.argv?.[1]?.includes("app.js")) {
  (async () => {
    const q = "ما هو الذكاء الاصطناعي وكيف يعمل؟";
    const a = await handleAskora(q);
    console.log("\n🧠 ASKORA ANSWER:\n", a);
  })();
}

