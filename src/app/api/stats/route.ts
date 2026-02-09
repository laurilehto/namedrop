import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, domainHistory } from "@/lib/schema";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export async function GET() {
  // Total count
  const allDomains = await db.select().from(domains);
  const total = allDomains.length;

  // Count by status
  const statusCounts: Record<string, number> = {};
  for (const d of allDomains) {
    statusCounts[d.currentStatus] = (statusCounts[d.currentStatus] || 0) + 1;
  }

  // Recent status changes (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentChanges = await db
    .select({
      id: domainHistory.id,
      domainId: domainHistory.domainId,
      domain: domains.domain,
      fromStatus: domainHistory.fromStatus,
      toStatus: domainHistory.toStatus,
      timestamp: domainHistory.timestamp,
    })
    .from(domainHistory)
    .innerJoin(domains, eq(domainHistory.domainId, domains.id))
    .where(
      and(
        eq(domainHistory.eventType, "status_change"),
        gte(domainHistory.timestamp, oneDayAgo)
      )
    )
    .orderBy(desc(domainHistory.timestamp))
    .limit(20);

  // Upcoming expirations (next 30 days)
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const upcomingExpirations = allDomains
    .filter((d) => d.expiryDate && d.expiryDate >= now && d.expiryDate <= thirtyDaysFromNow)
    .sort((a, b) => (a.expiryDate! > b.expiryDate! ? 1 : -1))
    .slice(0, 10);

  return NextResponse.json({
    total,
    statusCounts,
    recentChanges,
    upcomingExpirations,
  });
}
