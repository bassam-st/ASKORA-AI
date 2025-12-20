import { handleAskora } from "../app.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { question } = req.body || {};
    const q = (question || "").toString().trim();

    if (!q) {
      return res.status(400).json({ ok: false, error: "Empty question" });
    }

    // handleAskora سيرجع لنا: { answerText, sourcesList }
    const result = await handleAskora(q);

    return res.status(200).json({
      ok: true,
      answer: result?.answerText || "",
      sources: Array.isArray(result?.sourcesList) ? result.sourcesList : [],
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
