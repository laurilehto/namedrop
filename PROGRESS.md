# NameDrop — Progress

## Current Status: Phase 4 Complete, Deployed

**Last updated**: 2026-02-10

## Completed Phases

### Phase 1 — MVP (Core Monitoring)
- [x] Next.js project setup (TypeScript, Tailwind, shadcn/ui)
- [x] Drizzle ORM + SQLite schema & migrations
- [x] Domain CRUD (add, list, delete, update notes/tags)
- [x] RDAP engine with IANA bootstrap caching
- [x] RDAP status mapping to lifecycle states
- [x] Manual "check now" per domain
- [x] node-cron scheduler for periodic checks
- [x] Status dashboard with color-coded domain list
- [x] Domain detail page with status history
- [x] Dockerfile + docker-compose.yml

### Phase 2 — Notifications & Automation
- [x] Notification channel management (CRUD)
- [x] Webhook notifications (n8n compatible payload)
- [x] Telegram bot notifications
- [x] Email notifications (SMTP with STARTTLS/TLS)
- [x] ntfy push notifications
- [x] Adaptive check frequency based on domain state
- [x] Bulk domain import (CSV, text, one-per-line)
- [x] Export watchlist (JSON/CSV)
- [x] First-run setup wizard
- [x] n8n workflow template JSON (`n8n/namedrop-alerts.json`)

### Phase 3 — Auto-Registration
- [x] Registrar adapter interface
- [x] Dynadot adapter
- [x] Namecheap adapter
- [x] Gandi adapter
- [x] GoDaddy adapter
- [x] Encrypted credential storage (AES-256-GCM)
- [x] Sandbox/test mode toggle
- [x] Auto-register on domain availability
- [x] Registration attempt logging
- [x] Balance checking and low-balance alerts

### Phase 4 — Polish & Community
- [x] Simple password authentication (AUTH_PASSWORD env var)
- [x] Global search (Cmd+K) across domains, notes, tags
- [x] Tag management and filtering
- [x] Dark/light theme toggle (hydration-safe)
- [x] Domain valuation estimate (length, keywords, TLD scoring)
- [x] GitHub Actions CI/CD (GHCR image build on push to main)
- [x] File import (.txt, .csv, .json) for bulk domain add
- [x] JSON re-import of NameDrop export files

## Deployment

- **Image**: `ghcr.io/laurilehto/namedrop:latest`
- **CI/CD**: GitHub Actions builds and pushes on every push to `main`
- **Proxy**: Nginx Proxy Manager (external `proxy` Docker network)
- **Domain**: `namedrop.pilvi.in`
- **Auth**: Password-protected via `AUTH_PASSWORD` env var
- **Data**: SQLite in Docker volume `namedrop-data`
- **Docker socket**: Mounted for container management access

## Built-in Notification System

Already fully implemented and operational:

| Channel  | Status | Notes |
|----------|--------|-------|
| Webhook  | Ready  | n8n compatible payload, any URL |
| Telegram | Ready  | Bot token + chat ID |
| Email    | Ready  | SMTP with STARTTLS/TLS |
| ntfy     | Ready  | Self-hosted push notifications |

Configure via Settings > Notifications in the web UI. Each channel can filter which domain statuses trigger alerts. An n8n workflow template is included at `n8n/namedrop-alerts.json`.

## Potential Future Work

- [ ] Browser notifications (Web Push)
- [ ] Comprehensive API docs
- [ ] Adapter development guide
- [ ] Contributing guidelines
- [ ] PostgreSQL support (schema ready, connection string switch)
- [ ] Domain portfolio analytics / trends
- [ ] Multi-user support
- [ ] Webhook delivery retry logic
- [ ] Rate limiting on API routes
