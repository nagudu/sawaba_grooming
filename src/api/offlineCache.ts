/**
 * Offline-first cache for public API data (IndexedDB).
 *
 * Source-of-truth rules:
 *   - When online, the backend/database is authoritative; every successful
 *     GET refreshes the cache.
 *   - When a request fails (backend down, no network), the last cached copy
 *     is served so the site keeps working.
 *   - Only NON-SENSITIVE public data is cached here (services, barbers,
 *     gallery, approved reviews, payment settings). Never auth tokens,
 *     customer profiles, payments or admin data.
 */

const DB_NAME = 'sawaba-offline'
const DB_VERSION = 1
const STORE = 'responses'

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export interface CacheEntry {
  key: string
  value: unknown
  cachedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'))
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await openDb()
    return await new Promise<T | null>((resolve) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
      tx.oncomplete = () => db.close()
    })
  } catch {
    return null
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const entry = await withStore<CacheEntry>('readonly', (store) => store.get(key) as IDBRequest<CacheEntry>)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > MAX_AGE_MS) return null
  return entry.value as T
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const entry: CacheEntry = { key, value, cachedAt: Date.now() }
  await withStore('readwrite', (store) => store.put(entry) as IDBRequest<IDBValidKey>)
}

/**
 * Read-through cache helper for public GET requests:
 *   try network first (authoritative) → refresh cache
 *   on network failure → serve cached copy
 *   on success → also return `fresh: true` so callers can show a badge
 */
export async function cachedJson<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher()
    void cacheSet(key, data)
    return data
  } catch (error) {
    const cached = await cacheGet<T>(key)
    if (cached !== null) return cached
    throw error
  }
}
