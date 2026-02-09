import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/schema";

export async function GET() {
  const channels = await db.select().from(notificationChannels);
  return NextResponse.json(channels);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { type, name, config, enabled, notifyOn } = body;

  if (!type || !name) {
    return NextResponse.json(
      { error: "type and name are required" },
      { status: 400 }
    );
  }

  const validTypes = ["webhook", "telegram", "email", "ntfy"];
  if (!validTypes.includes(type)) {
    return NextResponse.json(
      { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  const result = await db
    .insert(notificationChannels)
    .values({
      type,
      name,
      config: JSON.stringify(config || {}),
      enabled: enabled !== false,
      notifyOn: JSON.stringify(notifyOn || ["available", "expiring_soon"]),
    })
    .returning();

  return NextResponse.json(result[0], { status: 201 });
}
