import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.type !== undefined) updates.type = body.type;
  if (body.config !== undefined) updates.config = JSON.stringify(body.config);
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.notifyOn !== undefined)
    updates.notifyOn = JSON.stringify(body.notifyOn);

  const result = await db
    .update(notificationChannels)
    .set(updates)
    .where(eq(notificationChannels.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json(result[0]);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db
    .delete(notificationChannels)
    .where(eq(notificationChannels.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
