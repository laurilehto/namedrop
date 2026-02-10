import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains } from "@/lib/schema";
import { eq, desc, asc, like, or } from "drizzle-orm";
import { isValidDomain, normalizeDomain, extractTLD } from "@/lib/utils/domain-parser";
import { performCheck } from "@/lib/check-domain";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");
  const sort = searchParams.get("sort") || "added_at";
  const order = searchParams.get("order") || "desc";
  const search = searchParams.get("search");

  let query = db.select().from(domains).$dynamic();

  if (status) {
    query = query.where(eq(domains.currentStatus, status));
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.where(
      or(
        like(domains.domain, pattern),
        like(domains.notes, pattern),
        like(domains.tags, pattern)
      )
    );
  }

  const sortCol =
    sort === "domain" ? domains.domain :
    sort === "status" ? domains.currentStatus :
    sort === "expiry_date" ? domains.expiryDate :
    sort === "last_checked" ? domains.lastChecked :
    sort === "priority" ? domains.priority :
    domains.addedAt;

  const results = await (order === "asc" ? query.orderBy(asc(sortCol)) : query.orderBy(desc(sortCol)));

  // Filter by tag in-memory (JSON array stored as text)
  let filtered = results;
  if (tag) {
    filtered = results.filter((d) => {
      try {
        const tags = JSON.parse(d.tags || "[]") as string[];
        return tags.includes(tag);
      } catch {
        return false;
      }
    });
  }

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { domain: rawDomain, notes, tags, priority, autoRegister } = body;

  if (!rawDomain) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 });
  }

  const domain = normalizeDomain(rawDomain);
  if (!isValidDomain(domain)) {
    return NextResponse.json({ error: "Invalid domain name" }, { status: 400 });
  }

  const tld = extractTLD(domain);
  const now = new Date().toISOString();

  try {
    const result = await db
      .insert(domains)
      .values({
        domain,
        tld,
        notes: notes || "",
        tags: JSON.stringify(tags || []),
        priority: priority || 0,
        autoRegister: autoRegister || false,
        nextCheck: now,
      })
      .returning();

    const inserted = result[0];

    // Run initial RDAP check
    try {
      await performCheck(inserted);
    } catch {
      // Non-fatal — domain is still added even if check fails
    }

    // Return the updated domain
    const updated = await db.select().from(domains).where(eq(domains.id, inserted.id)).get();
    return NextResponse.json(updated || inserted, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      return NextResponse.json({ error: "Domain already exists" }, { status: 409 });
    }
    throw err;
  }
}
