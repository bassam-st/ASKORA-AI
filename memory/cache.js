// memory/cache.js — V15
// كاش بسيط داخل الذاكرة (Serverless-safe: يعمل لنفس الـ instance فقط)
// ✅ يدعم أسماء دوال قديمة/جديدة: getCache/setCache + cacheGet/cacheSet

const _store = new Map();

/** @returns any | null */
export function cacheGet(key) {
  const k = String(key);
  const item = _store.get(k);
  if (!item) return null;

  // دعم شكلين: قد يكون مخزن كقيمة مباشرة أو كائن { value, exp }
  if (item && typeof item === "object" && "exp" in item && "value" in item) {
    if (item.exp && Date.now() > item.exp) {
      _store.delete(k);
      return null;
    }
    return item.value;
  }
  return item;
}

export function cacheSet(key, value, ttlMs = 2 * 60 * 1000) {
  const k = String(key);
  const exp = ttlMs > 0 ? Date.now() + ttlMs : 0;
  _store.set(k, { value, exp });

  // تنظيف لاحق (غير مضمون في serverless، لكنه مفيد داخل نفس الـ instance)
  if (ttlMs > 0) {
    setTimeout(() => {
      const it = _store.get(k);
      if (it && it.exp && Date.now() > it.exp) _store.delete(k);
    }, ttlMs).unref?.();
  }

  return value;
}

export function cacheHas(key) {
  return cacheGet(key) !== null;
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

// ✅ Aliases (للتوافق مع الاستيراد الموجود في engine_router.js)
export const getCache = cacheGet;
export const setCache = cacheSet;
