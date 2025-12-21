// memory/cache.js — VINFINITY FIX
// كاش بسيط داخل الذاكرة (Serverless-safe لنفس الـ instance)

const _store = new Map();

// ===== Aliases متوافقة مع engine_router =====
export function getCache(key) {
  return _store.get(String(key));
}

export function setCache(key, value, ttlMs = 2 * 60 * 1000) {
  const k = String(key);
  _store.set(k, value);

  if (ttlMs > 0) {
    setTimeout(() => {
      _store.delete(k);
    }, ttlMs).unref?.();
  }

  return value;
}

// ===== API إضافي (اختياري) =====
export function cacheHas(key) {
  return _store.has(String(key));
}

export function cacheDel(key) {
  return _store.delete(String(key));
}

export function cacheClear() {
  _store.clear();
}

export function cacheSize() {
  return _store.size;
}
