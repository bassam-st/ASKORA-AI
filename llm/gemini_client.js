// llm/gemini_client.js
// Gemini API (Free tier available) — requires env var: GEMINI_API_KEY
// Node 18+ has fetch built-in.

export async function geminiGenerate({
  model = "gemini-1.5-flash",
  system = "",
  prompt = "",
  temperature = 0.4,
  maxOutputTokens = 700,
}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return {
      ok: false,
      text: "",
      error: "Missing GEMINI_API_KEY env var",
    };
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${system}\n\n${prompt}`.trim() }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await safeText(res);
      return { ok: false, text: "", error: `Gemini HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() || "";

    return { ok: true, text, error: "" };
  } catch (e) {
    return { ok: false, text: "", error: String(e?.message || e) };
  }
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
