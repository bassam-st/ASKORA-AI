import { handleAskora } from "../app.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question } = req.body;
    const answer = await handleAskora(question);
    res.status(200).json({ answer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
