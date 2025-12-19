export function normalizeInput(text = "") {
  let t = text.toLowerCase();

  t = t.replace(/[أإآ]/g, "ا");
  t = t.replace(/ى/g, "ي");
  t = t.replace(/ة/g, "ه");

  t = t.replace(/[\u064B-\u065F]/g, "");
  t = t.replace(/[^\w\s\u0600-\u06FF]/g, " ");
  t = t.replace(/\s+/g, " ").trim();

  return t;
}
