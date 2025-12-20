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

    const answer = await handleAskora(q);
    return res.status(200).json({ ok: true, answer });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
