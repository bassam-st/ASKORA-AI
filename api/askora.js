import { handleAskora } from "../app.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { question } = req.body || {};
    const q = (question || "").toString().trim();
    if (!q) return res.status(400).json({ ok: false, error: "Empty question" });

    const result = await handleAskora(q);

    // يدعم أن handleAskora يرجع String أو Object
    const answerText =
      typeof result === "string"
        ? result
        : (result?.answer || result?.text || result?.output || "").toString();

    let sources = result?.sources ?? result?.citations ?? [];
    if (!Array.isArray(sources)) sources = []; // أهم سطر لحل خطأ slice/map

    return res.status(200).json({
      ok: true,
      answer: answerText,
      sources
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
