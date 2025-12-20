// api/askora.js
import { routeEngine } from "../engine/engine_router.js";
import { normalizeInput } from "../input/input_normalizer.js";

export default async function handler(req, res) {
  try {
    // CORS بسيط (اختياري)
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const body = req.body || {};
    const q = String(body.question || body.text || "").trim();

    if (!q) {
      return res.status(200).json({ ok: true, answer: "السؤال فارغ.", sources: [], note: "no_question" });
    }

    const cleaned = normalizeInput({ text: q, context: body.context || "" });

    const out = await routeEngine({
      text: cleaned.text,
      intent: body.intent || "",
      context: cleaned.context || "",
    });

    // ضمان مخرجات واجهة ثابتة
    return res.status(200).json({
      ok: true,
      answer: String(out?.answer || ""),
      sources: Array.isArray(out?.sources) ? out.sources : [],
      note: String(out?.note || ""),
      intent: String(out?.intent || ""),
    });
  } catch (e) {
    // ✅ مهما صار: JSON
    return res.status(200).json({
      ok: false,
      error: "Server error",
      message: String(e?.message || e || ""),
    });
  }
}
