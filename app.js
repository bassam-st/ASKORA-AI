// app.js — VINFINITY (اختياري للتجربة محلياً)
// على Vercel لن يتم تشغيله، لكنه مفيد للتجربة في Node.

import { normalizeInput } from "./input/input_normalizer.js";
import { routeEngine } from "./engine/engine_router.js";

async function run(q){
  const cleaned = normalizeInput({ text: q, context: "" });
  const out = await routeEngine({
    text: cleaned.text,
    text_normalized: cleaned.text_normalized,
    context: cleaned.context,
    intent: ""
  });
  console.log(out);
}

if (process?.argv?.[1]?.includes("app.js")) {
  run("مباريات اليوم");
}
