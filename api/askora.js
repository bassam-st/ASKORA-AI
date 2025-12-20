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

    const result = await handleAskora(q);

    // ✅ 1) جواب نص دائمًا
    const answerText =
      typeof result === "string"
        ? result
        : (result?.final || result?.answer || result?.text || result?.answerText || "").toString();

    // ✅ 2) مصادر: نجبرها تكون Array دائمًا
    let sources = result?.sources || result?.sourcesList || [];
    if (!Array.isArray(sources)) sources = [];

    // ✅ 3) نحول مصادر objects إلى نصوص بسيطة (حتى ما تخرب الواجهة)
    const sourcesList = sources.slice(0, 10).map((s) => {
      if (typeof s === "string") return s;
      if (s && typeof s === "object") {
        if (s.title && s.url) return `${s.title} — ${s.url}`;
        if (s.title) return s.title;
        if (s.url) return s.url;
        if (s.content) return String(s.content).slice(0, 140);
      }
      return String(s);
    });

    return res.status(200).json({
      ok: true,
      answer: answerText,
      sources: sourcesList
    });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Server error" });
  }
}
