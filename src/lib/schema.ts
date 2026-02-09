import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const domains = sqliteTable("domains", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  domain: text("domain").notNull().unique(),
  tld: text("tld").notNull(),
  addedAt: text("added_at").default(sql`(CURRENT_TIMESTAMP)`),
  lastChecked: text("last_checked"),
  nextCheck: text("next_check"),
  currentStatus: text("current_status").default("unknown").notNull(),
  previousStatus: text("previous_status"),
  expiryDate: text("expiry_date"),
  registrar: text("registrar"),
  rdapRaw: text("rdap_raw"),
  autoRegister: integer("auto_register", { mode: "boolean" }).default(false),
  registrarAdapter: text("registrar_adapter"),
  priority: integer("priority").default(0),
  notes: text("notes").default(""),
  tags: text("tags").default("[]"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const domainHistory = sqliteTable("domain_history", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  domainId: text("domain_id")
    .notNull()
    .references(() => domains.id, { onDelete: "cascade" }),
  timestamp: text("timestamp").default(sql`(CURRENT_TIMESTAMP)`),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  eventType: text("event_type").notNull(),
  details: text("details").default("{}"),
  notified: integer("notified", { mode: "boolean" }).default(false),
});

export const registrarConfigs = sqliteTable("registrar_configs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  adapterName: text("adapter_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  apiKey: text("api_key").notNull(),
  apiSecret: text("api_secret"),
  sandboxMode: integer("sandbox_mode", { mode: "boolean" }).default(true),
  extraConfig: text("extra_config").default("{}"),
  balance: real("balance"),
  balanceUpdated: text("balance_updated"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const notificationChannels = sqliteTable("notification_channels", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(),
  name: text("name").notNull(),
  config: text("config").notNull().default("{}"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  notifyOn: text("notify_on").default('["available","expiring_soon"]'),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DomainHistoryEntry = typeof domainHistory.$inferSelect;
export type Setting = typeof settings.$inferSelect;
