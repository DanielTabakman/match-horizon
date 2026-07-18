import "server-only";

type CacheEntry<T> = { expiresAt: number; value: T };
const CACHE = new Map<string, CacheEntry<unknown>>();

export async function cachedJson<T>({
  cacheKey,
  ttlMs,
  timeoutMs,
  url,
}: {
  cacheKey: string;
  ttlMs: number;
  timeoutMs: number;
  url: string;
}): Promise<T> {
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    const value = (await response.json()) as T;
    CACHE.set(cacheKey, { expiresAt: Date.now() + ttlMs, value });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}
