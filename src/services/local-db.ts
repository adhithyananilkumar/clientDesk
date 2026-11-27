/**
 * On-device storage for offline use (Expo SQLite):
 *  - kv:     small JSON documents (query cache snapshot, drafts, preferences)
 *  - outbox: writes made offline, replayed in order when back online
 *
 * If the running app binary has no ExpoSQLite native module (e.g. an older
 * development build or Expo Go mismatch), fall back to in-memory storage
 * instead of crashing at startup.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

function openDb(): SQLiteDatabase | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLite = require('expo-sqlite') as typeof import('expo-sqlite');
    const database = SQLite.openDatabaseSync('clientdesk-local.db');
    database.execSync(`
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
    return database;
  } catch (e) {
    console.warn('expo-sqlite unavailable; using in-memory storage. Rebuild the dev client to enable offline storage.', e);
    return null;
  }
}

const db = openDb();
const memKv = new Map<string, string>();
let memOutbox: OutboxRow[] = [];

export const kv = {
  get<T>(key: string): T | null {
    const raw = db ? db.getFirstSync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key)?.value : memKv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    const json = JSON.stringify(value);
    if (!db) {
      memKv.set(key, json);
      return;
    }
    db.runSync(
      'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      key,
      json,
      Date.now(),
    );
  },
  remove(key: string) {
    if (!db) {
      memKv.delete(key);
      return;
    }
    db.runSync('DELETE FROM kv WHERE key = ?', key);
  },
  removePrefix(prefix: string) {
    if (!db) {
      for (const k of [...memKv.keys()]) if (k.startsWith(prefix)) memKv.delete(k);
      return;
    }
    db.runSync("DELETE FROM kv WHERE key LIKE ? ESCAPE '\\'", prefix.replace(/[%_\\]/g, '\\$&') + '%');
  },
};

export type OutboxRow = { id: string; kind: string; payload: string; attempts: number; last_error: string | null; created_at: number };

export const outboxStore = {
  add(id: string, kind: string, payload: unknown) {
    if (!db) {
      if (!memOutbox.some((r) => r.id === id)) {
        memOutbox.push({ id, kind, payload: JSON.stringify(payload), attempts: 0, last_error: null, created_at: Date.now() });
      }
      return;
    }
    db.runSync(
      'INSERT OR IGNORE INTO outbox (id, kind, payload, created_at) VALUES (?, ?, ?, ?)',
      id,
      kind,
      JSON.stringify(payload),
      Date.now(),
    );
  },
  all(): OutboxRow[] {
    if (!db) return [...memOutbox];
    return db.getAllSync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at ASC');
  },
  /** Replace a queued row's payload (e.g. fold an edit into a not-yet-synced create). */
  update(id: string, payload: unknown) {
    const json = JSON.stringify(payload);
    if (!db) {
      memOutbox = memOutbox.map((r) => (r.id === id ? { ...r, payload: json } : r));
      return;
    }
    db.runSync('UPDATE outbox SET payload = ? WHERE id = ?', json, id);
  },
  remove(id: string) {
    if (!db) {
      memOutbox = memOutbox.filter((r) => r.id !== id);
      return;
    }
    db.runSync('DELETE FROM outbox WHERE id = ?', id);
  },
  fail(id: string, error: string) {
    if (!db) {
      memOutbox = memOutbox.map((r) => (r.id === id ? { ...r, attempts: r.attempts + 1, last_error: error } : r));
      return;
    }
    db.runSync('UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?', error, id);
  },
  clear() {
    memOutbox = [];
    db?.runSync('DELETE FROM outbox');
  },
};
