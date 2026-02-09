# NameDrop — Project Specification

## Overview

**NameDrop** is a self-hosted, open-source domain drop-catching application. It monitors registered domains of interest, tracks their lifecycle status via RDAP, and optionally auto-registers them through registrar APIs when they become available. Notifications and automation are handled via built-in alerts and optional n8n webhook integration.

The goal is a **single Docker Compose deployment** that anyone can run — no paid APIs required for basic monitoring, with optional registrar integration for automated catch attempts.

## Project Identity

- **Name**: NameDrop
- **Tagline**: "Self-hosted domain drop catching"
- **License**: MIT
- **Repository structure**: Monorepo

## Architecture

```
┌─────────────────────────────────────────┐
│         Frontend (Next.js)              │
│  - Domain watchlist management          │
│  - Status dashboard & timeline          │
│  - Registrar account configuration      │
│  - Notification settings                │
│  - Setup wizard (first-run)             │
└──────────────────┬──────────────────────┘
                   │ API Routes
┌──────────────────▼──────────────────────┐
│         Backend (Next.js API)           │
│  - RDAP polling engine                  │
│  - Domain lifecycle state machine       │
│  - Registrar adapter system             │
│  - Scheduler (node-cron)                │
│  - Webhook dispatcher (n8n, generic)    │
│  - Notification engine                  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│         Storage                         │
│  - SQLite (default, zero-config)        │
│  - PostgreSQL (optional, for scale)     │
│  - ORM: Drizzle                         │
└─────────────────────────────────────────┘
```

### Data Flow

```
[User adds domain to watchlist]
        ↓
[Stored in database with initial status "unknown"]
        ↓
[Scheduler triggers RDAP check (configurable interval)]
        ↓
[RDAP engine queries domain status]
        ↓
[State machine evaluates lifecycle phase]
        ↓
  ┌─────────────┬──────────────────────────┐
  │ No change   │ Status changed           │
  │ → update    │ → log history            │
  │   lastCheck │ → trigger notifications  │
  │             │ → if "available" and      │
  │             │   auto-register enabled:  │
  │             │   → call registrar API    │
  └─────────────┴──────────────────────────┘
```

## Tech Stack

| Layer           | Technology               | Rationale                                            |
| --------------- | ------------------------ | ---------------------------------------------------- |
| Framework       | Next.js 14+ (App Router) | Single project = frontend + API, simple Docker build |
| Language        | TypeScript               | Type safety, better DX                               |
| ORM             | Drizzle ORM              | Lightweight, SQLite + PostgreSQL support             |
| Database        | SQLite (default)         | Zero config, single file, easy backups               |
| Scheduler       | node-cron                | No external dependencies                             |
| Styling         | Tailwind CSS             | Utility-first, dark theme built-in                   |
| UI Components   | shadcn/ui                | Accessible, customizable, copy-paste                 |
| Deployment      | Docker Compose           | One command setup                                    |
| Auth (optional) | NextAuth.js              | Simple credentials provider for single-user          |

## Database Schema

### `domains` — Watched domains

```sql
CREATE TABLE domains (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  domain        TEXT NOT NULL UNIQUE,
  tld           TEXT NOT NULL,                    -- extracted from domain
  added_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_checked  DATETIME,
  next_check    DATETIME,
  current_status TEXT DEFAULT 'unknown',          -- see Domain Lifecycle
  previous_status TEXT,
  expiry_date   DATETIME,
  registrar     TEXT,
  rdap_raw      TEXT,                             -- last raw RDAP JSON
  auto_register BOOLEAN DEFAULT FALSE,            -- attempt auto-registration
  registrar_adapter TEXT,                          -- which adapter to use
  priority      INTEGER DEFAULT 0,                -- 0=normal, 1=high (check more often)
  notes         TEXT DEFAULT '',
  tags          TEXT DEFAULT '[]',                -- JSON array of tag strings
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `domain_history` — Status change log

```sql
CREATE TABLE domain_history (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  domain_id     TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  timestamp     DATETIME DEFAULT CURRENT_TIMESTAMP,
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  event_type    TEXT NOT NULL,                    -- 'status_change', 'check', 'registration_attempt'
  details       TEXT DEFAULT '{}',                -- JSON metadata
  notified      BOOLEAN DEFAULT FALSE
);
```

### `registrar_configs` — Registrar API credentials

```sql
CREATE TABLE registrar_configs (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  adapter_name  TEXT NOT NULL UNIQUE,             -- 'dynadot', 'namecheap', etc.
  display_name  TEXT NOT NULL,
  api_key       TEXT NOT NULL,                    -- encrypted at rest
  api_secret    TEXT,                             -- encrypted at rest
  sandbox_mode  BOOLEAN DEFAULT TRUE,             -- test mode by default!
  extra_config  TEXT DEFAULT '{}',                -- JSON, adapter-specific settings
  balance       REAL,                             -- cached account balance
  balance_updated DATETIME,
  enabled       BOOLEAN DEFAULT TRUE,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `notification_channels` — Where to send alerts

```sql
CREATE TABLE notification_channels (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  type          TEXT NOT NULL,                    -- 'email', 'telegram', 'webhook', 'ntfy'
  name          TEXT NOT NULL,
  config        TEXT NOT NULL DEFAULT '{}',       -- JSON: url, token, chat_id, etc.
  enabled       BOOLEAN DEFAULT TRUE,
  notify_on     TEXT DEFAULT '["available","expiring_soon"]', -- JSON array of events
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### `settings` — App-level configuration

```sql
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default settings:
-- check_interval_minutes: 60
-- expiring_threshold_days: 30
-- auto_register_enabled: false
-- rdap_timeout_ms: 10000
-- max_concurrent_checks: 5
-- proxy_url: null
-- auth_enabled: false
-- auth_password_hash: null
```

## Domain Lifecycle State Machine

Domains move through these states:

```
                    ┌──────────┐
      ┌─────────────│ unknown  │◄──── initial state
      │             └────┬─────┘
      │                  │ first RDAP check
      ▼                  ▼
┌──────────┐      ┌──────────────┐
│  error   │◄────►│  registered  │
└──────────┘      └──────┬───────┘
                         │ expiry_date - threshold
                         ▼
                  ┌──────────────────┐
                  │  expiring_soon   │
                  └──────┬───────────┘
                         │ enters grace period
                         ▼
                  ┌──────────────────┐
                  │  grace_period    │
                  └──────┬───────────┘
                         │ enters redemption
                         ▼
                  ┌──────────────────┐
                  │  redemption      │
                  └──────┬───────────┘
                         │ enters pending delete
                         ▼
                  ┌──────────────────┐
                  │  pending_delete  │
                  └──────┬───────────┘
                         │ domain drops
                         ▼
                  ┌──────────────────┐
                  │  available       │──► auto-register?
                  └──────┬───────────┘
                         │ registered by us or someone
                         ▼
                  ┌──────────────────┐
                  │  registered      │ (back to start)
                  └──────────────────┘
```

### Status definitions

| Status           | Description                          | Alert Level | Check Frequency |
| ---------------- | ------------------------------------ | ----------- | --------------- |
| `unknown`        | Not yet checked                      | none        | immediate       |
| `registered`     | Active registration, normal          | none        | standard        |
| `expiring_soon`  | Expiry within threshold (def. 30d)   | ⚠️ warning  | 2x frequency    |
| `grace_period`   | Expired, in auto-renew grace period  | ⚠️ warning  | 4x frequency    |
| `redemption`     | Redemption period (~30 days)         | 🔶 high     | 4x frequency    |
| `pending_delete` | About to be released (~5 days)       | 🔴 critical | every 15 min    |
| `available`      | Domain is available for registration | 🟢 action   | hourly          |
| `error`          | RDAP check failed                    | none        | standard        |

### Adaptive check frequency

The scheduler increases check frequency as a domain approaches its drop date:

- `registered` → every `check_interval_minutes` (default 60 min)
- `expiring_soon` → every 30 min
- `grace_period` → every 15 min
- `redemption` → every 15 min
- `pending_delete` → every 5 min (critical phase)
- `available` → every 60 min (monitoring if someone else grabs it)

## RDAP Engine

### How domain status checking works

RDAP (Registration Data Access Protocol) is the modern replacement for WHOIS. It returns structured JSON and is free to use with no API key.

### RDAP Bootstrap

Use the IANA RDAP bootstrap to find the correct server per TLD:

```
GET https://data.iana.org/rdap/dns.json
```

Cache this bootstrap file (updates rarely). Common mappings:

| TLD        | RDAP Server                                    |
| ---------- | ---------------------------------------------- |
| .com, .net | https://rdap.verisign.com/com/v1/domain/{name} |
| .org       | https://rdap.org/domain/{name}                 |
| .io        | https://rdap.nic.io/domain/{name}              |
| .fi        | Check Traficom                                 |
| Generic    | https://rdap.org/domain/{name} (fallback)      |

### RDAP Response Parsing

```typescript
interface RDAPResponse {
  objectClassName: "domain";
  handle: string;
  ldhName: string; // domain name
  status: string[]; // ["active", "client transfer prohibited", ...]
  events: Array<{
    eventAction: string; // "registration", "expiration", "last changed"
    eventDate: string; // ISO datetime
  }>;
  entities: Array<{
    // registrar info
    roles: string[];
    vcardArray: any[];
  }>;
}
```

### Status mapping from RDAP

```typescript
function mapRDAPStatus(
  rdapResponse: RDAPResponse | null,
  httpStatus: number,
): DomainStatus {
  if (httpStatus === 404) return "available";
  if (!rdapResponse) return "error";

  const statuses = rdapResponse.status || [];
  const expiryEvent = rdapResponse.events?.find(
    (e) => e.eventAction === "expiration",
  );
  const expiryDate = expiryEvent ? new Date(expiryEvent.eventDate) : null;
  const now = new Date();
  const daysUntilExpiry = expiryDate
    ? Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Check for redemption/pending delete EPP statuses
  if (statuses.includes("redemption period")) return "redemption";
  if (statuses.includes("pending delete")) return "pending_delete";

  // Check expiry proximity
  if (daysUntilExpiry !== null) {
    if (daysUntilExpiry < 0) return "grace_period";
    if (daysUntilExpiry <= settings.expiring_threshold_days)
      return "expiring_soon";
  }

  if (statuses.includes("active")) return "registered";

  return "registered"; // default for any valid response
}
```

### Rate Limiting & Politeness

- Max 5 concurrent RDAP requests
- Minimum 1 second between requests to the same RDAP server
- Exponential backoff on errors (1s, 2s, 4s, 8s, max 60s)
- User-Agent header: `NameDrop/1.0 (https://github.com/your-org/namedrop)`
- Cache RDAP bootstrap for 24 hours

## Registrar Adapter System

### Adapter interface

Each registrar adapter implements this interface:

```typescript
// /src/lib/adapters/types.ts

interface RegistrarAdapter {
  name: string; // 'dynadot', 'namecheap', etc.
  displayName: string;
  configSchema: AdapterConfigField[]; // for auto-generating settings UI

  // Core operations
  checkAvailability(domain: string): Promise<{
    available: boolean;
    price?: number;
    currency?: string;
  }>;

  registerDomain(
    domain: string,
    years?: number,
  ): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
    cost?: number;
  }>;

  getBalance(): Promise<{
    balance: number;
    currency: string;
  }>;

  // Optional
  getDomainInfo?(domain: string): Promise<any>;
  setNameservers?(domain: string, nameservers: string[]): Promise<boolean>;
}

interface AdapterConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "boolean" | "number";
  required: boolean;
  description: string;
  default?: any;
}
```

### Adapter file structure

```
/src/lib/adapters/
  index.ts              — adapter registry
  types.ts              — shared interfaces
  /dynadot/
    adapter.ts          — implements RegistrarAdapter
    README.md           — setup instructions for this registrar
  /namecheap/
    adapter.ts
    README.md
  /godaddy/
    adapter.ts
    README.md
```

### Priority adapters to implement

1. **Dynadot** — good API docs, reasonable pricing, supports sandbox mode
2. **Namecheap** — very popular, comprehensive API, sandbox available
3. **GoDaddy** — largest registrar, reseller API available

### Adapter registration

```typescript
// /src/lib/adapters/index.ts

import { DynadotAdapter } from "./dynadot/adapter";
import { NamecheapAdapter } from "./namecheap/adapter";

const adapters = new Map<string, () => RegistrarAdapter>();

export function registerAdapter(name: string, factory: () => RegistrarAdapter) {
  adapters.set(name, factory);
}

export function getAdapter(name: string): RegistrarAdapter | null {
  const factory = adapters.get(name);
  return factory ? factory() : null;
}

export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

// Register built-in adapters
registerAdapter("dynadot", () => new DynadotAdapter());
registerAdapter("namecheap", () => new NamecheapAdapter());
```

## Notification System

### Built-in channels

| Channel  | Config Required           | Notes                          |
| -------- | ------------------------- | ------------------------------ |
| Email    | SMTP host, port, user, pw | Or use n8n for email           |
| Telegram | Bot token, chat ID        | Easy setup, instant delivery   |
| Webhook  | URL                       | n8n, Zapier, Make, custom      |
| ntfy     | Server URL, topic         | Self-hosted push notifications |

### Webhook payload (n8n compatible)

When a domain status changes, NameDrop sends:

```json
{
  "event": "status_change",
  "domain": "example.com",
  "previous_status": "registered",
  "new_status": "available",
  "expiry_date": "2026-03-15T00:00:00Z",
  "registrar": "GoDaddy",
  "checked_at": "2026-02-08T14:30:00Z",
  "auto_register": true,
  "priority": 1,
  "tags": ["portfolio", "important"],
  "message": "🟢 example.com is now available!"
}
```

When auto-registration is attempted:

```json
{
  "event": "registration_attempt",
  "domain": "example.com",
  "adapter": "dynadot",
  "success": true,
  "order_id": "12345",
  "cost": 9.99,
  "currency": "USD",
  "timestamp": "2026-02-08T14:30:05Z",
  "message": "✅ example.com registered via Dynadot for $9.99"
}
```

### n8n workflow template

Include an importable n8n workflow JSON in the repo at `/n8n/namedrop-alerts.json`:

1. **Webhook node** — receives NameDrop events
2. **Switch node** — routes by `event` type and `new_status`
3. **Telegram/Email/Slack nodes** — sends formatted alerts
4. **Optional: HTTP Request** — callback to NameDrop API to confirm notification delivered

## Frontend Pages & UI

### Pages

| Route           | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `/`             | Dashboard — summary stats, recent activity       |
| `/domains`      | Watchlist — all monitored domains with status    |
| `/domains/add`  | Add domain(s) — single or bulk CSV import        |
| `/domains/[id]` | Domain detail — full history, RDAP data, actions |
| `/history`      | Global timeline of all status changes            |
| `/settings`     | App settings, notifications, registrar configs   |
| `/setup`        | First-run setup wizard                           |

### Dashboard widgets

- Total domains monitored
- Domains by status (pie/donut chart)
- Upcoming expirations (next 30 days)
- Recent status changes (last 24h)
- Next scheduled check countdown
- Registrar balance(s)

### Design guidelines

- **Dark theme** by default (terminal/hacker aesthetic fits domain monitoring)
- Clean, data-dense layout — inspired by Uptime Kuma, Grafana
- Status color coding consistent throughout:
  - 🟢 Green: available
  - 🔴 Red: registered (locked)
  - 🟡 Yellow: expiring soon
  - 🟠 Orange: grace/redemption
  - 🔵 Blue: pending delete (action needed)
  - ⚪ Gray: unknown/error
- Monospace font for domain names
- Responsive — works on mobile for quick checks
- Sortable, filterable, searchable domain table

### First-run setup wizard

On first launch, guide the user through:

1. **Welcome** — what NameDrop does
2. **Add domains** — paste a list or add one by one
3. **Notifications** — set up at least one channel (webhook URL, Telegram, email)
4. **Registrar** (optional) — configure API key for auto-registration
5. **Check interval** — how often to poll
6. **Done** — start monitoring

## API Routes

### Domain management

```
GET    /api/domains              — list all watched domains (supports ?status=, ?tag=, ?sort=)
POST   /api/domains              — add domain(s) to watchlist
GET    /api/domains/:id          — get domain details + history
PATCH  /api/domains/:id          — update domain settings (notes, auto_register, tags)
DELETE /api/domains/:id          — remove domain from watchlist
POST   /api/domains/:id/check    — trigger immediate RDAP check
POST   /api/domains/bulk         — bulk import from CSV/text
POST   /api/domains/export       — export watchlist as JSON/CSV
```

### Status & history

```
GET    /api/history              — global status change timeline (paginated)
GET    /api/stats                — dashboard statistics
```

### Registrar

```
GET    /api/adapters             — list available registrar adapters
GET    /api/adapters/:name/schema — get config schema for adapter
POST   /api/adapters/:name/test  — test registrar connection
GET    /api/adapters/:name/balance — check registrar balance
POST   /api/register/:domainId   — manually trigger registration attempt
```

### Settings & notifications

```
GET    /api/settings             — get all settings
PATCH  /api/settings             — update settings
GET    /api/notifications        — list notification channels
POST   /api/notifications        — add notification channel
PATCH  /api/notifications/:id    — update channel
DELETE /api/notifications/:id    — delete channel
POST   /api/notifications/test   — send test notification
```

### Scheduler

```
GET    /api/scheduler/status     — scheduler status, next run time
POST   /api/scheduler/run        — trigger manual check of all domains
```

## Docker Deployment

### docker-compose.yml

```yaml
version: "3.8"

services:
  namedrop:
    build: .
    container_name: namedrop
    ports:
      - "3000:3000"
    volumes:
      - namedrop-data:/app/data # SQLite database + config
    environment:
      - DATABASE_URL=file:/app/data/namedrop.db
      - AUTH_SECRET=${AUTH_SECRET:-changeme}
      # Optional: PostgreSQL instead of SQLite
      # - DATABASE_URL=postgresql://user:pass@db:5432/namedrop
    restart: unless-stopped

volumes:
  namedrop-data:
```

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### One-command deploy

```bash
git clone https://github.com/your-org/namedrop.git
cd namedrop
docker compose up -d
# Open http://localhost:3000 → setup wizard
```

## Environment Variables

| Variable        | Default                   | Description                                 |
| --------------- | ------------------------- | ------------------------------------------- |
| `DATABASE_URL`  | `file:./data/namedrop.db` | SQLite path or PostgreSQL connection string |
| `AUTH_SECRET`   | (required if auth on)     | NextAuth.js secret for session encryption   |
| `AUTH_PASSWORD` | (none)                    | Optional: enable simple password auth       |
| `PORT`          | `3000`                    | HTTP port                                   |
| `LOG_LEVEL`     | `info`                    | `debug`, `info`, `warn`, `error`            |

All other configuration (check intervals, notifications, registrar keys) is managed through the web UI and stored in the database.

## Project File Structure

```
namedrop/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── next.config.js
├── tailwind.config.ts
├── CLAUDE.md                          ← this file
├── README.md                          ← user-facing docs
├── LICENSE
│
├── /n8n
│   └── namedrop-alerts.json           ← importable n8n workflow
│
├── /src
│   ├── /app                           ← Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                   ← Dashboard
│   │   ├── /domains
│   │   │   ├── page.tsx               ← Watchlist
│   │   │   ├── /add/page.tsx          ← Add domain(s)
│   │   │   └── /[id]/page.tsx         ← Domain detail
│   │   ├── /history/page.tsx          ← Timeline
│   │   ├── /settings/page.tsx         ← Settings
│   │   ├── /setup/page.tsx            ← First-run wizard
│   │   └── /api                       ← API routes
│   │       ├── /domains/route.ts
│   │       ├── /history/route.ts
│   │       ├── /settings/route.ts
│   │       ├── /adapters/route.ts
│   │       ├── /notifications/route.ts
│   │       └── /scheduler/route.ts
│   │
│   ├── /components
│   │   ├── /ui                        ← shadcn/ui components
│   │   ├── DomainTable.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── DomainCard.tsx
│   │   ├── StatsWidget.tsx
│   │   ├── TimelineEntry.tsx
│   │   ├── SetupWizard.tsx
│   │   └── AdapterConfigForm.tsx
│   │
│   ├── /lib
│   │   ├── db.ts                      ← Drizzle client
│   │   ├── schema.ts                  ← Drizzle schema
│   │   ├── rdap.ts                    ← RDAP engine
│   │   ├── scheduler.ts              ← node-cron scheduler
│   │   ├── notifications.ts          ← notification dispatcher
│   │   ├── crypto.ts                 ← encrypt/decrypt registrar keys
│   │   ├── /adapters
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   ├── /dynadot/adapter.ts
│   │   │   ├── /namecheap/adapter.ts
│   │   │   └── /godaddy/adapter.ts
│   │   └── /utils
│   │       ├── domain-parser.ts      ← extract TLD, validate domain
│   │       └── rate-limiter.ts       ← per-server rate limiting
│   │
│   └── /hooks
│       ├── useDomains.ts
│       ├── useSettings.ts
│       └── useScheduler.ts
│
├── /data                              ← SQLite database (Docker volume)
│   └── namedrop.db
│
└── /docs
    ├── adapters.md                    ← how to write a registrar adapter
    ├── api.md                         ← API reference
    └── n8n-setup.md                   ← n8n integration guide
```

## Implementation Phases

### Phase 1 — MVP (Core Monitoring)

- [ ] Next.js project setup with TypeScript, Tailwind, shadcn/ui
- [ ] Drizzle ORM + SQLite schema & migrations
- [ ] Domain CRUD (add, list, delete, update notes/tags)
- [ ] RDAP engine with bootstrap caching
- [ ] RDAP status mapping to lifecycle states
- [ ] Manual "check now" per domain
- [ ] node-cron scheduler for periodic checks
- [ ] Status dashboard with color-coded domain list
- [ ] Domain detail page with status history
- [ ] Dockerfile + docker-compose.yml
- [ ] Basic README

### Phase 2 — Notifications & Automation

- [ ] Notification channel management (CRUD)
- [ ] Webhook notifications (n8n compatible payload)
- [ ] Telegram bot notifications
- [ ] Email notifications (SMTP)
- [ ] ntfy push notifications
- [ ] Adaptive check frequency based on domain state
- [ ] Bulk domain import (CSV, text, one-per-line)
- [ ] Export watchlist (JSON/CSV)
- [ ] First-run setup wizard
- [ ] n8n workflow template JSON

### Phase 3 — Auto-Registration

- [ ] Registrar adapter interface
- [ ] Dynadot adapter implementation
- [ ] Namecheap adapter implementation
- [ ] Encrypted credential storage
- [ ] Sandbox/test mode toggle
- [ ] Auto-register on domain availability
- [ ] Registration attempt logging
- [ ] Balance checking and low-balance alerts
- [ ] GoDaddy adapter

### Phase 4 — Polish & Community

- [ ] Simple password authentication (optional)
- [ ] Global search across domains
- [ ] Tag management and filtering
- [ ] Dark/light theme toggle
- [ ] Domain valuation estimate (length, keywords, TLD)
- [ ] Browser notifications (Web Push)
- [ ] Comprehensive API docs
- [ ] Adapter development guide
- [ ] Contributing guidelines
- [ ] GitHub Actions CI/CD

## Security Considerations

- **Registrar API keys** are encrypted at rest using AES-256-GCM with a key derived from `AUTH_SECRET`
- **No default credentials** — setup wizard forces configuration on first run
- **Sandbox mode by default** — registrar adapters start in test mode to prevent accidental purchases
- **Rate limiting** on API routes to prevent abuse
- **No telemetry** — fully offline, no phone-home
- **CORS** configured for same-origin only by default
- Input validation on all domain names (RFC 1035 compliance)

## Comparable Projects & Inspiration

- **Uptime Kuma** — self-hosted monitoring (UI inspiration, Docker simplicity)
- **Changedetection.io** — self-hosted web change monitoring (similar UX pattern)
- **DomainMOD** — domain portfolio management (feature overlap, but no drop catching)

NameDrop fills the gap: none of these do automated domain drop catching in a self-hosted package.

## Contributing an Adapter

To add a new registrar:

1. Create `/src/lib/adapters/your-registrar/adapter.ts`
2. Implement the `RegistrarAdapter` interface
3. Add `configSchema` with required fields (API key, etc.)
4. Register in `/src/lib/adapters/index.ts`
5. Add `/src/lib/adapters/your-registrar/README.md` with setup instructions
6. Submit PR

## Technical Notes

- **CORS with RDAP**: Some RDAP servers don't send CORS headers. Since this runs server-side (Next.js API routes), this is not an issue — all RDAP requests go from the server, not the browser.
- **TLD coverage**: Not all TLDs support RDAP yet. For those that don't, fall back to displaying "RDAP not available" and allow manual status updates.
- **Timezone handling**: All timestamps stored in UTC. Frontend converts to local time.
- **SQLite concurrency**: SQLite with WAL mode handles the expected load fine. PostgreSQL option exists for users running many thousands of domains.
