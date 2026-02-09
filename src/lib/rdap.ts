import { withRateLimit } from "./utils/rate-limiter";

export type DomainStatus =
  | "unknown"
  | "registered"
  | "expiring_soon"
  | "grace_period"
  | "redemption"
  | "pending_delete"
  | "available"
  | "error";

interface RDAPEvent {
  eventAction: string;
  eventDate: string;
}

interface RDAPEntity {
  roles: string[];
  vcardArray?: unknown[];
  handle?: string;
}

interface RDAPResponse {
  objectClassName: string;
  ldhName: string;
  status: string[];
  events: RDAPEvent[];
  entities?: RDAPEntity[];
}

export interface DomainCheckResult {
  status: DomainStatus;
  expiryDate: string | null;
  registrar: string | null;
  rdapRaw: string | null;
  error?: string;
}

// Bootstrap cache
let bootstrapCache: Record<string, string[]> | null = null;
let bootstrapFetchedAt = 0;
const BOOTSTRAP_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Known RDAP servers for common TLDs (fallback)
const KNOWN_SERVERS: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1",
  net: "https://rdap.verisign.com/net/v1",
  org: "https://rdap.org",
};

async function fetchBootstrap(): Promise<Record<string, string[]>> {
  const now = Date.now();
  if (bootstrapCache && now - bootstrapFetchedAt < BOOTSTRAP_TTL) {
    return bootstrapCache;
  }

  try {
    const res = await fetch("https://data.iana.org/rdap/dns.json", {
      headers: { "User-Agent": "NameDrop/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();

    const mapping: Record<string, string[]> = {};
    for (const [tlds, servers] of data.services) {
      for (const tld of tlds) {
        mapping[tld.toLowerCase()] = servers;
      }
    }

    bootstrapCache = mapping;
    bootstrapFetchedAt = now;
    return mapping;
  } catch {
    // Return cache even if stale, or empty
    return bootstrapCache || {};
  }
}

function getRDAPServerForTLD(tld: string, bootstrap: Record<string, string[]>): string | null {
  const servers = bootstrap[tld.toLowerCase()];
  if (servers && servers.length > 0) {
    return servers[0].replace(/\/$/, "");
  }
  return KNOWN_SERVERS[tld.toLowerCase()] || null;
}

function extractRegistrar(response: RDAPResponse): string | null {
  if (!response.entities) return null;
  for (const entity of response.entities) {
    if (entity.roles?.includes("registrar")) {
      if (entity.vcardArray && Array.isArray(entity.vcardArray[1])) {
        for (const field of entity.vcardArray[1]) {
          if (Array.isArray(field) && field[0] === "fn") {
            return field[3] as string;
          }
        }
      }
      if (entity.handle) return entity.handle;
    }
  }
  return null;
}

function mapRDAPStatus(
  response: RDAPResponse | null,
  httpStatus: number,
  expiringThresholdDays: number
): DomainStatus {
  if (httpStatus === 404) return "available";
  if (!response) return "error";

  const statuses = response.status || [];

  // Check for redemption/pending delete EPP statuses
  if (statuses.some((s) => s.toLowerCase().includes("redemption"))) return "redemption";
  if (statuses.some((s) => s.toLowerCase().includes("pending delete"))) return "pending_delete";

  // Check expiry proximity
  const expiryEvent = response.events?.find((e) => e.eventAction === "expiration");
  if (expiryEvent) {
    const expiryDate = new Date(expiryEvent.eventDate);
    const now = new Date();
    const daysUntilExpiry = Math.floor(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) return "grace_period";
    if (daysUntilExpiry <= expiringThresholdDays) return "expiring_soon";
  }

  return "registered";
}

export async function checkDomain(
  domain: string,
  tld: string,
  expiringThresholdDays: number = 30,
  timeoutMs: number = 10000
): Promise<DomainCheckResult> {
  const bootstrap = await fetchBootstrap();
  const server = getRDAPServerForTLD(tld, bootstrap);

  if (!server) {
    return {
      status: "error",
      expiryDate: null,
      registrar: null,
      rdapRaw: null,
      error: `No RDAP server found for TLD: .${tld}`,
    };
  }

  const url = `${server}/domain/${domain}`;

  try {
    const response = await withRateLimit(server, async () => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/rdap+json",
          "User-Agent": "NameDrop/1.0",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res;
    });

    if (response.status === 404) {
      return {
        status: "available",
        expiryDate: null,
        registrar: null,
        rdapRaw: null,
      };
    }

    if (!response.ok) {
      return {
        status: "error",
        expiryDate: null,
        registrar: null,
        rdapRaw: null,
        error: `RDAP returned HTTP ${response.status}`,
      };
    }

    const data: RDAPResponse = await response.json();
    const rdapRaw = JSON.stringify(data);

    const expiryEvent = data.events?.find((e) => e.eventAction === "expiration");
    const expiryDate = expiryEvent?.eventDate || null;

    const registrar = extractRegistrar(data);
    const status = mapRDAPStatus(data, response.status, expiringThresholdDays);

    return {
      status,
      expiryDate,
      registrar,
      rdapRaw,
    };
  } catch (err) {
    return {
      status: "error",
      expiryDate: null,
      registrar: null,
      rdapRaw: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export function getCheckIntervalMinutes(status: DomainStatus): number {
  switch (status) {
    case "unknown":
      return 1;
    case "registered":
      return 60;
    case "expiring_soon":
      return 30;
    case "grace_period":
      return 15;
    case "redemption":
      return 15;
    case "pending_delete":
      return 5;
    case "available":
      return 60;
    case "error":
      return 60;
    default:
      return 60;
  }
}
