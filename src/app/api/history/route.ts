import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domainHistory, domains } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  const entries = await db
    .select({
      id: domainHistory.id,
      domainId: domainHistory.domainId,
      domain: domains.domain,
      fromStatus: domainHistory.fromStatus,
      toStatus: domainHistory.toStatus,
      eventType: domainHistory.eventType,
      timestamp: domainHistory.timestamp,
      details: domainHistory.details,
    })
    .from(domainHistory)
    .innerJoin(domains, eq(domainHistory.domainId, domains.id))
    .orderBy(desc(domainHistory.timestamp))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({ entries, page, limit });
}
