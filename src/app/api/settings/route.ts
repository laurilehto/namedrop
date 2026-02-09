import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const allSettings = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const s of allSettings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(body)) {
    await db
      .insert(settings)
      .values({ key, value: String(value), updatedAt: now })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(value), updatedAt: now },
      });
  }

  // Return updated settings
  const allSettings = await db.select().from(settings);
  const result: Record<string, string> = {};
  for (const s of allSettings) {
    result[s.key] = s.value;
  }
  return NextResponse.json(result);
}
