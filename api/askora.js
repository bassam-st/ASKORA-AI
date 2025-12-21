// api/askora.js
import { routeEngine } from "../engine/engine_router.js";
import { normalizeInput } from "../input/input_normalizer.js";

function safeJsonParse(maybeJson) {
  try {
    if (typeof maybeJson === "string") return JSON.parse(maybeJson);
    return maybeJson || {};
  } catch {
    return {};
  }
}

export default async function handler(req, res) {
  // ✅ دائما JSON حتى لو Vercel حاول يحط HTML (نحن نرد من هنا)
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  try {
    if (req.method === "OPTIONS") {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // ✅ body قد يكون object أو string
    const body = safeJsonParse(req.body);

    const q = String(body.question || body.text || "").trim();
    if (!q) {
      return res.status(400).json({
        ok: false,
        error: "Empty question",
        answer: "السؤال فارغ.",
        sources: [],
        note: "no_question",
      });
    }

    const cleaned = normalizeInput({ text: q, context: body.context || "" });

    const out = await routeEngine({
      text: cleaned.text,
      intent: body.intent || "",
      context: cleaned.context || "",
    });

    // ✅ واجهة ثابتة
    return res.status(200).json({
      ok: true,
      answer: String(out?.answer || ""),
      sources: Array.isArray(out?.sources) ? out.sources : [],
      note: String(out?.note || ""),
      intent: String(out?.intent || ""),
    });
  } catch (e) {
    // ✅ مهما صار: JSON
    return res.status(500).json({
      ok: false,
      error: "Server error",
      message: String(e?.message || e || ""),
    });
  }
}
