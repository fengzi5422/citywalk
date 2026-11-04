import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.js'

let db = null

export function getDb() {
  if (!db) throw new Error('数据库尚未初始化')
  return db
}

export function initDb() {
  mkdirSync(dirname(config.dbPath), { recursive: true })
  db = new DatabaseSync(config.dbPath)

  // 早期版本的 shares 表没有 owner_key，开发阶段直接重建（分享是临时数据）
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shares'").all()
  if (tables.length) {
    const cols = db.prepare('PRAGMA table_info(shares)').all().map((c) => c.name)
    if (!cols.includes('owner_key')) db.exec('DROP TABLE shares')
  }

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trips (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      city       TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS shares (
      token      TEXT PRIMARY KEY,
      trip_id    TEXT NOT NULL,
      user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
      owner_key  TEXT NOT NULL,
      payload    TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked    INTEGER NOT NULL DEFAULT 0,
      views      INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_shares_trip ON shares(trip_id);
    CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id);
  `)

  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}
