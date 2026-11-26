// Uses Node.js' built-in SQLite module (Node 22.5+, recommended Node 24 LTS).
// This avoids native npm add-ons and therefore avoids better-sqlite3 build errors.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbFile = process.env.DATABASE_FILE || './data/tours.sqlite';
const absolute = path.resolve(dbFile);
fs.mkdirSync(path.dirname(absolute), { recursive: true });
const db = new DatabaseSync(absolute);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      daily_limit INTEGER NOT NULL DEFAULT 100 CHECK(daily_limit > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT
    );
    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      request_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(api_key_id) REFERENCES api_keys(id)
    );
    CREATE INDEX IF NOT EXISTS idx_api_usage_key_date ON api_usage(api_key_id, created_at);
  `);
}
module.exports = { db, initializeDatabase };
