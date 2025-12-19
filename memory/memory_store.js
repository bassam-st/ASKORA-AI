import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_FILE = path.join(__dirname, "session_memory.json");
const LONG_FILE = path.join(__dirname, "long_term_memory.json");

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
}

async function writeJsonSafe(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// آخر 8 رسائل كسياق
export async function getSessionContext() {
  const session = await readJsonSafe(SESSION_FILE, { turns: [] });
  const last = session.turns.slice(-8);
  return last.map((t) => `U:${t.user} | A:${shorten(t.answer)}`).join("\n");
}

export async function rememberTurn({ user, intent, answer }) {
  const session = await readJsonSafe(SESSION_FILE, { turns: [] });
  session.turns.push({ user, intent, answer, time: Date.now() });
  if (session.turns.length > 50) session.turns = session.turns.slice(-50);
  await writeJsonSafe(SESSION_FILE, session);

  // long-term: خزّن فقط الأسئلة المهمة (شرح/مقارنة)
  if (intent === "explain" || intent === "compare") {
    const long = await readJsonSafe(LONG_FILE, { items: [] });
    long.items.push({ user, answer, time: Date.now() });
    if (long.items.length > 200) long.items = long.items.slice(-200);
    await writeJsonSafe(LONG_FILE, long);
  }
}

export async function searchLongTerm(query) {
  const long = await readJsonSafe(LONG_FILE, { items: [] });
  const q = (query || "").trim();
  if (!q) return null;

  // بحث بسيط: أول نتيجة تحتوي كلمة
  const hit = long.items.find((x) => x.user.includes(q));
  return hit || null;
}

function shorten(s = "") {
  const t = String(s).replace(/\s+/g, " ").trim();
  return t.length > 140 ? t.slice(0, 140) + "..." : t;
}
