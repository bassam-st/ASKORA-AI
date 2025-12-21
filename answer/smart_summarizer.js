// answer/smart_summarizer.js
// Smart Summarizer v3
// ✅ schedule: يعطي "زر فتح يلا كورة" + فهم ناقص/زائد
// ✅ يرجع نص مرتب جدًا + روابط جاهزة

function clean(s = "") {
  return String(s || "").replace(/\s+/g, " ").replace(/\uFFFD/g, "").trim();
}

function clip(s = "", max = 350) {
  const t = clean(s);
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function extractTeamOrLeague(q = "") {
  // نأخذ كلمات ذات معنى من السؤال لاستخدامها في بحث يلا كورة
  const text = clean(q)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";

  // كلمات يجب تجاهلها
  const stop = new Set([
    "مباريات","مباراة","اليوم","الان","الآن","بكرة","غدا","غداً","جدول","نتائج","ترتيب",
    "كرة","القدم","الدوري","كاس","كأس","متى","ماهي","ايش","وش","هل","كم","كيف","وين","أين","اين"
  ]);

  const words = text.split(" ").filter(Boolean);
  const keep = [];
  for (const w of words) {
    if (w.length < 2) continue;
    if (stop.has(w)) continue;
    keep.push(w);
  }

  // نرجع 3 كلمات كحد أقصى للبحث
  return keep.slice(0, 3).join(" ");
}

function buildYallaLinks(question = "") {
  // رابط مباريات اليوم (مركز المباريات)
  const todayCenter = "https://www.yallakora.com/match-center";

  // رابط بحث داخل يلا كورة (لو المستخدم ذكر فريق/دوري)
  const key = extractTeamOrLeague(question);
  const search = key
    ? `https://www.yallakora.com/search?query=${encodeURIComponent(key)}`
    : "";

  return { todayCenter, search, key };
}

function pickSources(sources = [], n = 4) {
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
      content: clip(s.content, 220),
    });
    if (out.length >= n) break;
  }
  return out;
}

export function smartSummarize({ question = "", intent = "general", sources = [] } = {}) {
  const q = clean(question);
  const it = String(intent || "general").toLowerCase().trim();

  const picked = pickSources(sources, 4);

  // ✅ نية المباريات/الجدول
  if (it === "schedule") {
    const { todayCenter, search, key } = buildYallaLinks(q);

    return [
      `📅 **مباريات اليوم**`,
      q ? `سؤالك: **${q}**` : "",
      "",
      `✅ افتح مباريات اليوم مباشرة (يلا كورة):`,
      `${todayCenter}`,
      "",
      key
        ? `🔎 بحث سريع داخل يلا كورة عن: **${key}**\n${search}`
        : `✍️ إذا كتبت اسم فريق/دوري (مثال: الهلال / ريال مدريد) سأفتح لك البحث مباشرة.`,
      "",
      "### ملاحظة",
      "التطبيق حالياً يعتمد على روابط موثوقة + تلخيص،",
      "ولو تريد *قائمة المباريات داخل التطبيق* (المباراة + الوقت + البطولة) لازم نربط Sports API (أفضل).",
      "",
      "### مصادر إضافية (اختياري)",
      picked.length
        ? picked.map((s) => `• ${s.title || "مصدر"}\n  ${s.link || ""}`.trim()).join("\n")
        : "• لا توجد مصادر إضافية.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // عام
  const top = picked[0]?.content || "";
  return [
    "🧠 **ملخص**",
    q ? `سؤالك: **${q}**` : "",
    "",
    top ? `• ${clip(top, 520)}` : "• لم تظهر مقتطفات كافية من البحث.",
    "",
    "### المصادر",
    picked.length
      ? picked.map((s) => `• ${s.title || "مصدر"}\n  ${s.link || ""}`.trim()).join("\n")
      : "• لا توجد مصادر.",
  ]
    .filter(Boolean)
    .join("\n");
}
