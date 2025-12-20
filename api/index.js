import { handleAskora } from "../app.js";

export default async function handler(req, res) {
  // CORS (اختياري مفيد)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // السماح فقط بـ POST
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const question = (body.question ?? body.q ?? "").toString().trim();

    if (!question) {
      return res.status(400).json({ ok: false, error: "Empty question" });
    }

    const answer = await handleAskora(question);

    // ✅ مهم: لا نرجّع sources إلا لو كانت مصفوفة فعلاً
    // عشان نتجنب خطأ: sources.slice(...).map is not a function
    let sources = [];
    if (answer && typeof answer === "object") {
      // لو routeEngine يرجّع كائن
      sources = Array.isArray(answer.sources) ? answer.sources : [];
      return res.status(200).json({
        ok: true,
        answer: answer.text ?? answer.answer ?? JSON.stringify(answer),
        sources
      });
    }

    // لو routeEngine يرجّع نص
    return res.status(200).json({ ok: true, answer: String(answer), sources: [] });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
