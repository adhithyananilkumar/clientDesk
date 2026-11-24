import * as SQLite from 'expo-sqlite';

/**
 * On-device storage for offline use (Expo SQLite):
 *  - kv:     small JSON documents (query cache snapshot, drafts, preferences)
 *  - outbox: writes made offline, replayed in order when back online
 */
const db = SQLite.openDatabaseSync('clientdesk-local.db');

db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL
  );
`);

export const kv = {
  get<T>(key: string): T | null {
    const row = db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    if (!row) return null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    db.runSync(
      'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      key,
      JSON.stringify(value),
      Date.now(),
    );
  },
  remove(key: string) {
    db.runSync('DELETE FROM kv WHERE key = ?', key);
  },
  removePrefix(prefix: string) {
    db.runSync("DELETE FROM kv WHERE key LIKE ? ESCAPE '\\'", prefix.replace(/[%_\\]/g, '\\$&') + '%');
  },
};

export type OutboxRow = { id: string; kind: string; payload: string; attempts: number; last_error: string | null; created_at: number };

export const outboxStore = {
  add(id: string, kind: string, payload: unknown) {
    db.runSync(
      'INSERT OR IGNORE INTO outbox (id, kind, payload, created_at) VALUES (?, ?, ?, ?)',
      id,
      kind,
      JSON.stringify(payload),
      Date.now(),
    );
  },
  all(): OutboxRow[] {
    return db.getAllSync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at ASC');
  },
  remove(id: string) {
    db.runSync('DELETE FROM outbox WHERE id = ?', id);
  },
  fail(id: string, error: string) {
    db.runSync('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?', error, id);
  },
  clear() {
    db.runSync('DELETE FROM outbox');
  },
};
