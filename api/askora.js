// api/askora.js — VINFINITY
import { routeEngine } from "../engine/engine_router.js";
import { normalizeInput } from "../input/input_normalizer.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).json({ ok: true });

  if (req.method !== "POST") {
    return res.status(200).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const q = String(body.question || body.text || "").trim();
    const ctx = String(body.context || "").trim();

    if (!q) {
      return res.status(200).json({
        ok: true,
        answer: "السؤال فارغ.",
        sources: [],
        note: "no_question",
        intent: "general",
        confidence: "—",
      });
    }

    const cleaned = normalizeInput({ text: q, context: ctx });

    const out = await routeEngine({
      text: cleaned.text,
      text_normalized: cleaned.text_normalized,
      context: cleaned.context,
      intent: String(body.intent || "").trim(),
    });

    return res.status(200).json({
      ok: true,
      answer: String(out?.answer || ""),
      sources: Array.isArray(out?.sources) ? out.sources : [],
      note: String(out?.note || ""),
      intent: String(out?.intent || "general"),
      confidence: String(out?.confidence || "—"),
    });
  } catch (e) {
    return res.status(200).json({
      ok: false,
      error: "Server error",
      message: String(e?.message || e || ""),
    });
  }
}
