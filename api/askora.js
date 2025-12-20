// api/askora.js
import { handleAskora } from "../app.js";

export default async function handler(req, res) {
  // السماح فقط بـ POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { question } = req.body || {};
    const q = (question || "").toString().trim();

    if (!q) {
      return res.status(400).json({ ok: false, error: "Empty question" });
    }

    const out = await handleAskora(q);

    // لو رجّع نص فقط
    if (typeof out === "string") {
      return res.status(200).json({
        ok: true,
        answer: out,
        sources: [],
      });
    }

    // لو رجّع Object (المفروض)
    if (out && typeof out === "object") {
      // نضمن شكل ثابت
      return res.status(200).json({
        ok: true,
        answer: String(out.answer ?? out.final ?? ""),
        sources: Array.isArray(out.sources) ? out.sources : [],
        note: out.note || "",
        intent: out.intent || "",
      });
    }

    return res.status(200).json({ ok: true, answer: String(out || ""), sources: [] });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || "Server error" });
  }
}
