// answer/smart_summarizer.js — V15
// يحول نتائج البحث لرد مرتب "يشبه نموذج" حتى بدون LLM

function clip(s = "", max = 300) {
  const t = String(s || "").trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

function hostOf(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function bestSource(sources = []) {
  if (!Array.isArray(sources) || !sources.length) return null;
  // أول مصدر غالبًا مرتب مسبقًا في engine_router
  return sources[0] || null;
}

function formatSourcesList(sources = [], limit = 5) {
  const arr = Array.isArray(sources) ? sources.slice(0, limit) : [];
  if (!arr.length) return "";
  return arr
    .map((s, i) => {
      const title = clip(s?.title || hostOf(s?.link) || `مصدر ${i + 1}`, 60);
      const link = String(s?.link || "").trim();
      return `- ${title}\n  ${link}`;
    })
    .join("\n");
}

function scheduleAnswer({ question, sources }) {
  const top = bestSource(sources);
  const topLink = top?.link || "https://www.yallakora.com/match-center";

  // لو ما فيه مصادر: أعطي رابط ثابت مباشرة
  const open = `✅ افتح مباريات اليوم مباشرة (يلا كورة):\n${topLink || "https://www.yallakora.com/match-center"}`;

  // حاول تمييز هل المستخدم يطلب "مشاهدة/بث" بدل جدول فقط
  const q = String(question || "");
  const wantsWatch = /مشاه|بث|لايف|قناه|watch|live/i.test(q);

  const tips = wantsWatch
    ? [
        "اكتب اسم المباراة أو الفريق: (ريال مدريد) أو (برشلونة) وسأفتح لك أقرب صفحة/مركز مباريات.",
        "إذا تريد القنوات الناقلة: اكتب (القنوات الناقلة + اسم المباراة).",
      ]
    : [
        "إذا كتبت اسم فريق (الهلال/ريال مدريد/برشلونة) سأحاول أجلب لك روابط أقرب لمركز مباريات الفريق.",
        "للحصول على الجدول داخل التطبيق بالكامل نحتاج Sports API (اختياري).",
      ];

  return [
    "🧠 **ASKORA — مباريات اليوم**",
    "",
    open,
    "",
    "### ماذا تقدر تسوي الآن؟",
    `- ${tips[0]}`,
    `- ${tips[1]}`,
    "",
    sources?.length ? "### مصادر موثوقة:" : "### ملاحظة:",
    sources?.length ? formatSourcesList(sources, 5) : "لا توجد نتائج بحث كافية الآن.",
  ].join("\n");
}

function generalAnswer({ question, sources }) {
  const top = bestSource(sources);
  const topLink = top?.link ? `\n🔗 أفضل مصدر:\n${top.link}` : "";

  // فقرة موجزة من أفضل snippet
  const snippet = top?.content ? clip(top.content, 320) : "";

  const body = snippet
    ? `📌 **خلاصة سريعة:**\n${snippet}`
    : "📌 **خلاصة سريعة:** لم أجد نصوصًا كافية من البحث لتلخيص واضح.";

  return [
    "🧠 **ASKORA — ملخص ذكي**",
    "",
    `**سؤالك:** ${clip(question, 140)}`,
    "",
    body,
    topLink,
    "",
    sources?.length ? "### مصادر:" : "### مصادر:",
    sources?.length ? formatSourcesList(sources, 5) : "لا توجد مصادر — تحقق من إعدادات البحث.",
  ].join("\n");
}

export function smartSummarize({
  question = "",
  intent = "general",
  sources = [],
} = {}) {
  if (intent === "schedule") {
    return scheduleAnswer({ question, sources });
  }
  return generalAnswer({ question, sources });
}
