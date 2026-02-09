import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";
import { existsSync, mkdirSync } from "fs";
import path from "path";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") || "./data/namedrop.db";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _initialized = false;

function createDb() {
  const dir = path.dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const database = drizzle(sqlite, { schema });

  if (!_initialized) {
    _initialized = true;

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS domains (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL UNIQUE,
        tld TEXT NOT NULL,
        added_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        last_checked TEXT,
        next_check TEXT,
        current_status TEXT NOT NULL DEFAULT 'unknown',
        previous_status TEXT,
        expiry_date TEXT,
        registrar TEXT,
        rdap_raw TEXT,
        auto_register INTEGER DEFAULT 0,
        registrar_adapter TEXT,
        priority INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );

      CREATE TABLE IF NOT EXISTS domain_history (
        id TEXT PRIMARY KEY,
        domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        timestamp TEXT DEFAULT (CURRENT_TIMESTAMP),
        from_status TEXT,
        to_status TEXT NOT NULL,
        event_type TEXT NOT NULL,
        details TEXT DEFAULT '{}',
        notified INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS registrar_configs (
        id TEXT PRIMARY KEY,
        adapter_name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        api_secret TEXT,
        sandbox_mode INTEGER DEFAULT 1,
        extra_config TEXT DEFAULT '{}',
        balance REAL,
        balance_updated TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );

      CREATE TABLE IF NOT EXISTS notification_channels (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        enabled INTEGER DEFAULT 1,
        notify_on TEXT DEFAULT '["available","expiring_soon"]',
        created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    const defaultSettings: Record<string, string> = {
      check_interval_minutes: "60",
      expiring_threshold_days: "30",
      auto_register_enabled: "false",
      rdap_timeout_ms: "10000",
      max_concurrent_checks: "5",
      low_balance_threshold: "10",
    };

    const insertSetting = sqlite.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );

    for (const [key, value] of Object.entries(defaultSettings)) {
      insertSetting.run(key, value);
    }
  }

  return database;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});
