import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarConfigs } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getInitializedAdapter } from "@/lib/adapters";

export async function GET(
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

  try {
    const balance = await adapter.getBalance();
    const now = new Date().toISOString();

    await db
      .update(registrarConfigs)
      .set({ balance: balance.balance, balanceUpdated: now })
      .where(eq(registrarConfigs.id, id));

    return NextResponse.json({ ...balance, updatedAt: now });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get balance" },
      { status: 500 }
    );
  }
}
