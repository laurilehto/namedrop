import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { domains, domainHistory } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const domain = await db.select().from(domains).where(eq(domains.id, id)).get();
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  const history = await db
    .select()
    .from(domainHistory)
    .where(eq(domainHistory.domainId, id))
    .orderBy(desc(domainHistory.timestamp));

  return NextResponse.json({ ...domain, history });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.tags !== undefined) updates.tags = JSON.stringify(body.tags);
  if (body.autoRegister !== undefined) updates.autoRegister = body.autoRegister;
  if (body.registrarAdapter !== undefined) updates.registrarAdapter = body.registrarAdapter;
  if (body.priority !== undefined) updates.priority = body.priority;
  updates.updatedAt = new Date().toISOString();

  const result = await db
    .update(domains)
    .set(updates)
    .where(eq(domains.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db.delete(domains).where(eq(domains.id, id)).returning();
  if (result.length === 0) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
