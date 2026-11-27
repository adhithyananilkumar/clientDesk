/** Web fallback: the same API over localStorage (nothing during server rendering). */
const storage = typeof window === 'undefined' ? null : window.localStorage;
const KV = 'cd.kv.';
const OUTBOX = 'cd.outbox';

export const kv = {
  get<T>(key: string): T | null {
    const raw = storage?.getItem(KV + key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      storage?.setItem(KV + key, JSON.stringify(value));
    } catch {
      // Quota exceeded: caching is best effort.
    }
  },
  remove(key: string) {
    storage?.removeItem(KV + key);
  },
  removePrefix(prefix: string) {
    if (!storage) return;
    for (const key of Object.keys(storage)) if (key.startsWith(KV + prefix)) storage.removeItem(key);
  },
};

export type OutboxRow = { id: string; kind: string; payload: string; attempts: number; last_error: string | null; created_at: number };

function read(): OutboxRow[] {
  try {
    return JSON.parse(storage?.getItem(OUTBOX) ?? '[]') as OutboxRow[];
  } catch {
    return [];
  }
}
function write(rows: OutboxRow[]) {
  storage?.setItem(OUTBOX, JSON.stringify(rows));
}

export const outboxStore = {
  add(id: string, kind: string, payload: unknown) {
    const rows = read();
    if (rows.some((r) => r.id === id)) return;
    rows.push({ id, kind, payload: JSON.stringify(payload), attempts: 0, last_error: null, created_at: Date.now() });
    write(rows);
  },
  all: read,
  update(id: string, payload: unknown) {
    write(read().map((r) => (r.id === id ? { ...r, payload: JSON.stringify(payload) } : r)));
  },
  remove(id: string) {
    write(read().filter((r) => r.id !== id));
  },
  fail(id: string, error: string) {
    write(read().map((r) => (r.id === id ? { ...r, attempts: r.attempts + 1, last_error: error } : r)));
  },
  clear() {
    write([]);
  },
};
