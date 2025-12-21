// answer/smart_summarizer.js
// Smart Summarizer v2 (بدون نموذج)
// هدفه: إجابة قصيرة مرتبة + لا يهلوس + يعتمد على snippets فقط

function clip(s = "", max = 400) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function uniq(arr = []) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = String(x || "").trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function pickTopSnippets(sources = [], { maxItems = 3 } = {}) {
  const items = Array.isArray(sources) ? sources : [];
  const scored = items
    .map((s) => {
      const title = String(s?.title || "").trim();
      const content = String(s?.content || "").trim();
      const link = String(s?.link || "").trim();
      const len = content.length;
      const score = (title ? 5 : 0) + Math.min(25, Math.floor(len / 25));
      return { title, content, link, score };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return scored.slice(0, maxItems);
}

export function smartSummarize({ question = "", intent = "general", sources = [] } = {}) {
  const q = String(question || "").trim();
  const it = String(intent || "general").trim();

  // ✅ حالة المباريات: لا نطول (الواجهة ستعرض زر فتح مباشر)
  if (it === "schedule") {
    return [
      "⚽ **مباريات اليوم**",
      "✅ افتح مركز المباريات مباشرة من الزر (يلا كورة).",
      "",
      "_ملاحظة: لعرض قائمة المباريات داخل التطبيق (الوقت/الفرق) نحتاج Sports API._",
    ].join("\n");
  }

  const top = pickTopSnippets(sources, { maxItems: 3 });

  if (!top.length) {
    return [
      "لم أجد مصادر كافية في البحث الآن.",
      q ? `سؤالك: **${clip(q, 120)}**` : "",
      "جرّب إعادة صياغة السؤال أو إضافة تفاصيل بسيطة.",
    ].filter(Boolean).join("\n");
  }

  const bullets = [];
  for (const t of top) {
    const line = clip(t.content, 220);
    if (line) bullets.push(`- ${line}`);
  }

  const titles = uniq(top.map((x) => x.title).filter(Boolean)).slice(0, 2);

  const header = titles.length
    ? `**خلاصة من مصادر متعددة** (مثل: ${titles.map((x) => `“${clip(x, 40)}”`).join("، ")})`
    : "**خلاصة من مصادر متعددة**";

  return [
    header,
    "",
    ...bullets.slice(0, 4),
    "",
    "إذا تريد إجابة أدق: اكتب جزء/تفصيل إضافي (اسم مكان/اسم شخص/تاريخ).",
  ].join("\n");
}
