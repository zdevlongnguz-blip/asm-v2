// Cache RAM đơn giản (Map + thời hạn).
const cacheStore = new Map();

export async function cached(key, ttlMs, fetcher) {
  if (!key) {
    return fetcher();
  }

  const now = Date.now();
  const item = cacheStore.get(key);

  if (item && now - item.createdAt < ttlMs) {
    return item.value;
  }

  const value = await fetcher();
  cacheStore.set(key, { createdAt: now, value });
  return value;
}
