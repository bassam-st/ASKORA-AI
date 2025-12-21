// memory/cache.js
// كاش بسيط داخل الذاكرة (Serverless-safe: يعمل لنفس الـ instance فقط)

const _store = new Map();

export function cacheGet(key) {
  return _store.get(String(key));
}

export function cacheSet(key, value, ttlMs = 2 * 60 * 1000) {
  const k = String(key);
  _store.set(k, value);

  // TTL بسيط
  if (ttlMs > 0) {
    setTimeout(() => {
      _store.delete(k);
    }, ttlMs).unref?.();
  }

  return value;
}

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
