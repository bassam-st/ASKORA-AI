// intent/intent_classifier.js
// Advanced Intent Classifier (AR + EN)
// Priority: Intelligence > Speed > Accuracy

/**
 * شكل الـ Intent النهائي:
 * {
 *   main_intent,
 *   sub_intent,
 *   question_type,
 *   depth,
 *   requires_sources,
 *   requires_numbers,
 *   temporal,
 *   language,
 *   confidence
 * }
 */

const AR_QUESTION_WORDS = {
  where: ["أين", "وين"],
  who: ["من", "مين"],
  what: ["ما", "ماذا", "ايش"],
  how: ["كيف"],
  how_many: ["كم", "عدد"],
  when: ["متى"],
  why: ["لماذا", "ليش"],
  compare: ["قارن", "مقارنة", "الفرق"],
};

const EN_QUESTION_WORDS = {
  where: ["where"],
  who: ["who"],
  what: ["what"],
  how: ["how"],
  how_many: ["how many", "how much"],
  when: ["when"],
  why: ["why"],
  compare: ["compare", "difference", "vs"],
};

const DOMAIN_KEYWORDS = {
  geography: [
    "دولة","بلد","مدينة","عاصمة","قارة","حدود","موقع","تقع",
    "country","city","capital","continent","location","located"
  ],
  person: [
    "شخص","رئيس","ملك","نبي","لاعب","مخترع",
    "person","president","king","player","inventor"
  ],
  economy: [
    "اقتصاد","سعر","تكلفة","راتب","عملة","ناتج",
    "economy","price","cost","salary","currency","gdp"
  ],
  history: [
    "تاريخ","قديما","سنة","حرب","حدث",
    "history","year","war","event"
  ],
  technology: [
    "تقنية","ذكاء","برمجة","نظام","تطبيق",
    "technology","ai","programming","system","app"
  ],
  health: [
    "صحة","مرض","علاج","دواء",
    "health","disease","treatment","medicine"
  ]
};

function detectLanguage(text) {
  if (/[ء-ي]/.test(text)) return "ar";
  if (/[a-zA-Z]/.test(text)) return "en";
  return "unknown";
}

function includesAny(text, list) {
  return list.some(k => text.includes(k));
}

function detectQuestionType(text, lang) {
  const map = lang === "ar" ? AR_QUESTION_WORDS : EN_QUESTION_WORDS;

  for (const [type, words] of Object.entries(map)) {
    if (includesAny(text, words)) return type;
  }
  return "statement";
}

function detectDomain(text) {
  for (const [domain, words] of Object.entries(DOMAIN_KEYWORDS)) {
    if (includesAny(text, words)) return domain;
  }
  return "general";
}

function estimateDepth(text) {
  if (text.length <= 40) return "short";
  if (text.length <= 90) return "summary";
  return "detailed";
}

function needsNumbers(text) {
  return /\d|كم|how many|how much|عدد|سعر/.test(text);
}

function isTemporal(text) {
  return includesAny(text, [
    "متى","اليوم","الآن","سنة","عام",
    "when","today","now","year"
  ]);
}

export function classifyIntent({ text = "", context = "" } = {}) {
  const t = String(text || "").toLowerCase();
  const ctx = String(context || "").toLowerCase();

  const language = detectLanguage(t);
  const question_type = detectQuestionType(t, language);
  const domain = detectDomain(t);
  const depth = estimateDepth(t);

  let main_intent = domain;
  let sub_intent = question_type;

  let requires_sources = true;
  let requires_numbers = needsNumbers(t);
  let temporal = isTemporal(t);

  // تخصيصات ذكية
  if (question_type === "where") {
    main_intent = "geography";
    sub_intent = "location";
  }

  if (question_type === "who") {
    main_intent = "person";
    sub_intent = "identity";
  }

  if (question_type === "compare") {
    main_intent = domain;
    sub_intent = "comparison";
  }

  if (question_type === "statement") {
    requires_sources = false;
  }

  // حساب ثقة مبدئية
  let confidence = 0.6;
  if (question_type !== "statement") confidence += 0.15;
  if (domain !== "general") confidence += 0.15;
  if (language !== "unknown") confidence += 0.1;

  if (confidence > 1) confidence = 1;

  return {
    main_intent,
    sub_intent,
    question_type,
    depth,
    requires_sources,
    requires_numbers,
    temporal,
    language,
    confidence,
  };
}
