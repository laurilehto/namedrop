import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { performCheck } from "@/lib/check-domain";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const domain = await db.select().from(domains).where(eq(domains.id, id)).get();
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const result = await performCheck(domain);
  return NextResponse.json(result);
}
