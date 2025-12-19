import { normalizeInput } from "./input/input_normalizer.js";
import { classifyIntent } from "./intent/intent_classifier.js";
import { getSessionContext } from "./memory/session_memory.js";
import { routeEngine } from "./engine/engine_router.js";

async function ASKORA(userInput) {
  const clean = normalizeInput(userInput);
  const intent = classifyIntent(clean);
  const context = getSessionContext(clean);

  const answer = await routeEngine({
    text: clean,
    intent,
    context
  });

  console.log("\n🧠 ASKORA ANSWER:\n", answer);
}

// تجربة
ASKORA("ما هو الذكاء الاصطناعي وكيف يعمل؟");
