import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarConfigs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getInitializedAdapter } from "@/lib/adapters";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const config = await db
    .select()
    .from(registrarConfigs)
    .where(eq(registrarConfigs.id, id))
    .get();

  if (!config) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  const adapter = await getInitializedAdapter(config.adapterName);
  if (!adapter) {
    return NextResponse.json(
      { error: "Failed to initialize adapter" },
      { status: 500 }
    );
  }

  const result = await adapter.testConnection();

  return NextResponse.json(result);
}
