// llm/gemini_client.js
// Gemini API — requires env var: GEMINI_API_KEY
// This version tries multiple API versions + multiple model names to avoid 404 model issues.

export async function geminiGenerate({
  model = "auto",
  system = "",
  prompt = "",
  temperature = 0.4,
  maxOutputTokens = 700,
}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, text: "", error: "Missing GEMINI_API_KEY env var" };
  }

  // ✅ نماذج احتياطية (جرّبها بالترتيب)
  const modelCandidates = [];
  if (model && model !== "auto") modelCandidates.push(model);

  modelCandidates.push(
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite"
  );

  // ✅ جرّب نسختين API
  const apiVersions = ["v1beta", "v1"];

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

  let lastErr = "";

  for (const ver of apiVersions) {
    for (const m of modelCandidates) {
      const url =
        `https://generativelanguage.googleapis.com/${ver}/models/${encodeURIComponent(
          m
        )}:generateContent?key=${encodeURIComponent(key)}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await safeText(res);
          lastErr = `Gemini HTTP ${res.status} (${ver}/${m}): ${errText}`;
          continue; // جرّب موديل/نسخة ثانية
        }

        const data = await res.json();
        const text =
          data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("")?.trim() || "";

        if (!text) {
          lastErr = `Empty response (${ver}/${m})`;
          continue;
        }

        return { ok: true, text, error: "" };
      } catch (e) {
        lastErr = String(e?.message || e);
      }
    }
  }

  return { ok: false, text: "", error: lastErr || "Gemini error" };
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
