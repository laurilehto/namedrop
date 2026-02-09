import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarConfigs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/crypto";

function maskKey(encrypted: string): string {
  return "****" + encrypted.slice(-8);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const existing = await db
    .select()
    .from(registrarConfigs)
    .where(eq(registrarConfigs.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};

  if (body.displayName !== undefined) updates.displayName = body.displayName;
  if (body.sandboxMode !== undefined) updates.sandboxMode = body.sandboxMode;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.extraConfig !== undefined) {
    updates.extraConfig = JSON.stringify(body.extraConfig);
  }
  if (body.apiKey !== undefined) {
    updates.apiKey = encrypt(body.apiKey);
  }
  if (body.apiSecret !== undefined) {
    updates.apiSecret = body.apiSecret ? encrypt(body.apiSecret) : null;
  }

  const result = await db
    .update(registrarConfigs)
    .set(updates)
    .where(eq(registrarConfigs.id, id))
    .returning();

  const config = result[0];
  return NextResponse.json({
    ...config,
    apiKey: maskKey(config.apiKey),
    apiSecret: config.apiSecret ? maskKey(config.apiSecret) : null,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const result = await db
    .delete(registrarConfigs)
    .where(eq(registrarConfigs.id, id))
    .returning();

  if (result.length === 0) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
