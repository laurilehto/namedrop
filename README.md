# NameDrop

Self-hosted domain drop catching. Monitor registered domains, track their lifecycle via RDAP, and catch them when they become available.

## Features

- Domain watchlist with RDAP status monitoring
- Lifecycle state tracking (registered, expiring, grace period, redemption, pending delete, available)
- Adaptive check frequency based on domain state
- Dark-themed dashboard with status overview
- Bulk domain import
- SQLite database (zero config)
- Docker deployment

## Quick Start

### Docker (Recommended)

```bash
git clone https://github.com/your-org/namedrop.git
cd namedrop
docker compose up -d
```

Open http://localhost:3000

### Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Tech Stack

- **Next.js 14+** — App Router, TypeScript
- **Tailwind CSS** + **shadcn/ui** — Dark theme UI
- **Drizzle ORM** + **SQLite** — Zero-config database
- **node-cron** — Background scheduling
- **RDAP** — Free domain status checking (no API key needed)

## License

MIT
