// answer/smart_summarizer.js — VINFINITY
// يولد "ملخص كنموذج" من snippets + يضيف توجيه ذكي + روابط واضحة.

function clip(s="", max=900){
  const t = String(s||"").trim();
  return t.length <= max ? t : t.slice(0, max-1) + "…";
}

function host(url=""){
  try{ return new URL(url).hostname.replace(/^www\./,"").toLowerCase(); }
  catch{ return ""; }
}

function pickBestLink(sources, preferHosts=[]){
  const arr = Array.isArray(sources) ? sources : [];
  if(!arr.length) return "";

  for (const ph of preferHosts){
    const found = arr.find(s => {
      const h = host(s?.link || "");
      return h === ph || h.endsWith("." + ph);
    });
    if(found?.link) return found.link;
  }

  const any = arr.find(s => String(s?.link || "").trim());
  return any?.link || "";
}

function bullets(lines){
  return lines.filter(Boolean).map(x => `• ${x}`).join("\n");
}

function section(title, body){
  const t = String(title||"").trim();
  const b = String(body||"").trim();
  if(!b) return "";
  return `**${t}**\n${b}\n`;
}

function cleanQ(q=""){
  return String(q||"").replace(/\s+/g," ").trim();
}

export function smartSummarize({
  question,
  question_normalized,
  intent="general",
  sources=[],
  confidence
} = {}) {
  const q = cleanQ(question);
  const qn = cleanQ(question_normalized || q);
  const src = Array.isArray(sources) ? sources : [];
  const confScore = Number(confidence?.score || 0.55);
  const confLabel = confScore >= 0.78 ? "ثقة عالية" : confScore >= 0.56 ? "ثقة متوسطة" : "ثقة منخفضة";

  if (intent === "schedule") {
    const matchCenter = pickBestLink(src, ["yallakora.com"]) || "https://www.yallakora.com/match-center";
    const tips = bullets([
      "افتح الرابط الآن لعرض مباريات اليوم مباشرة.",
      "اكتب اسم الفريق + (اليوم) لو تبغى تخصيص: مثال (الهلال اليوم) أو (ريال مدريد اليوم).",
      "لو تبغى النتائج بدل الجدول: اكتب (نتائج اليوم)."
    ]);

    return [
      "✅ **مباريات اليوم ⚽**",
      `🔗 رابط مباشر:\n${matchCenter}`,
      "",
      section("كيف فهمت سؤالك؟", bullets([
        `السؤال: ${q || qn || "—"}`,
        `النية: schedule — ${confLabel}`
      ])),
      section("ماذا تعمل الآن؟", tips),
      section("ملاحظة مهمة", "لعرض الجدول داخل التطبيق (وقت/قنوات/نتيجة) نحتاج Sports API (إضافة اختيارية).")
    ].filter(Boolean).join("\n");
  }

  if (intent === "news") {
    const items = src.slice(0, 6).map((s, i) => {
      const t = (s?.title || "").trim() || `خبر ${i+1}`;
      const l = (s?.link || "").trim();
      return l ? `• ${t}\n  ${l}` : `• ${t}`;
    }).join("\n");

    return [
      "📰 **روابط أخبار مقترحة**",
      items || "لا توجد نتائج واضحة الآن.",
      "",
      section("اقتراح لتحسين الدقة", "اكتب: (أخبار + اسم الشخص/الدولة/الشركة).")
    ].join("\n");
  }

  // General / define / where / etc.
  const top = src.slice(0, 4);
  const snippets = top
    .map(s => String(s?.content || "").trim())
    .filter(Boolean)
    .map(x => clip(x, 320));

  const bestLink = pickBestLink(src, ["wikipedia.org","britannica.com"]) || (src[0]?.link || "");

  const main = snippets.length ? bullets(snippets) : "لم أجد محتوى كافي من البحث. جرّب صياغة أخرى أو كلمات أكثر تحديداً.";

  return [
    "🧠 **ملخص ذكي**",
    main,
    "",
    bestLink ? `🔗 **أفضل مصدر مرجعي:**\n${bestLink}` : "",
    "",
    section("فهم السؤال", bullets([
      `السؤال: ${q || qn || "—"}`,
      `النية: ${String(intent)} — ${confLabel}`
    ]))
  ].filter(Boolean).join("\n");
}
