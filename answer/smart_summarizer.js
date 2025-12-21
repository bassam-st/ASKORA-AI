// answer/smart_summarizer.js
// Smart Summarizer v2 (بدون نموذج)
// ✅ مخرجات مرتبة جدًا
// ✅ schedule: يعرض روابط قوية + توجيه واضح بدل كلام عام

function clean(s = "") {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\uFFFD/g, "")
    .trim();
}

function clip(s = "", max = 400) {
  const t = clean(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function getHost(url = "") {
  try {
    const u = new URL(url);
    return (u.hostname || "").replace(/^www\./, "");
  } catch {
    return "";
  }
}

function pickSources(sources = [], n = 6) {
  const arr = Array.isArray(sources) ? sources : [];
  const out = [];
  const seen = new Set();

  for (const s of arr) {
    if (!s) continue;
    const link = clean(s.link);
    if (link && seen.has(link)) continue;
    if (link) seen.add(link);

    out.push({
      title: clean(s.title),
      link,
      host: getHost(link),
      content: clip(s.content, 280),
    });

    if (out.length >= n) break;
  }
  return out;
}

function formatSourcesList(picked = []) {
  if (!picked.length) return "• لا توجد مصادر كافية حالياً.";
  return picked
    .map((s, i) => {
      const name = s.host || s.title || `مصدر ${i + 1}`;
      return `• ${name}${s.link ? `\n  ${s.link}` : ""}`;
    })
    .join("\n");
}

function isSchedule(intent = "") {
  return String(intent || "").trim().toLowerCase() === "schedule";
}

export function smartSummarize({ question = "", intent = "general", sources = [] } = {}) {
  const q = clean(question);
  const it = String(intent || "general").trim().toLowerCase();
  const picked = pickSources(sources, 6);

  // ✅ إخراج منظم لنوايا schedule
  if (isSchedule(it)) {
    return [
      `📅 **جدول مباريات اليوم**`,
      q ? `سؤالك: **${q}**` : "",
      "",
      "### ✅ أفضل طريقة للوصول للجدول بسرعة",
      "هذه روابط مباشرة تعرض مباريات اليوم وتحديث النتائج لحظة بلحظة:",
      "",
      formatSourcesList(picked),
      "",
      "### 🎯 لتجهيز جدول مرتب داخل التطبيق",
      "اكتب الدوري/البلد مثل:",
      "• الدوري السعودي",
      "• الدوري الإسباني",
      "• دوري أبطال أوروبا",
      "",
      "وسأرجع لك: (المباراة – التوقيت – القناة/الملعب إن وجد) حسب المصادر.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // ✅ إخراج عام مرتب
  const top = picked[0]?.content || "";
  return [
    `🧠 **ملخص**`,
    q ? `سؤالك: **${q}**` : "",
    "",
    "### أهم نقطة",
    top ? `• ${clip(top, 520)}` : "• لم تظهر مقتطفات كافية داخل نتائج البحث.",
    "",
    "### المصادر",
    formatSourcesList(picked),
  ]
    .filter(Boolean)
    .join("\n");
}
