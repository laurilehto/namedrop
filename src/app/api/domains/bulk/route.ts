import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { parseDomainInput, extractTLD } from "@/lib/utils/domain-parser";
import { performCheck } from "@/lib/check-domain";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { input, tags, priority } = body;

  if (!input) {
    return NextResponse.json({ error: "Input is required" }, { status: 400 });
  }

  const domainList = parseDomainInput(input);

  if (domainList.length === 0) {
    return NextResponse.json({ error: "No valid domains found" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const results = { added: [] as string[], skipped: [] as string[], errors: [] as string[] };

  for (const domain of domainList) {
    try {
      await db.insert(domains).values({
        domain,
        tld: extractTLD(domain),
        tags: JSON.stringify(tags || []),
        priority: priority || 0,
        nextCheck: now,
      });
      results.added.push(domain);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        results.skipped.push(domain);
      } else {
        results.errors.push(domain);
      }
    }
  }

  // Run RDAP checks on all newly added domains
  for (const domainName of results.added) {
    try {
      const row = await db.select().from(domains).where(eq(domains.domain, domainName)).get();
      if (row) await performCheck(row);
    } catch {
      // Non-fatal
    }
  }

  return NextResponse.json(results, { status: 201 });
}
