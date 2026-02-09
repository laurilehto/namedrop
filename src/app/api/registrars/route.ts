import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { registrarConfigs } from "@/lib/schema";
import { encrypt } from "@/lib/crypto";
import { listAdapterTypes } from "@/lib/adapters";

function maskKey(encrypted: string): string {
  return "****" + encrypted.slice(-8);
}

export async function GET() {
  const configs = await db.select().from(registrarConfigs);
  const adapterTypes = listAdapterTypes();

  const masked = configs.map((c) => ({
    ...c,
    apiKey: maskKey(c.apiKey),
    apiSecret: c.apiSecret ? maskKey(c.apiSecret) : null,
  }));

  return NextResponse.json({ configs: masked, adapterTypes });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { adapterName, displayName, apiKey, apiSecret, sandboxMode, extraConfig } = body;

  if (!adapterName || !displayName || !apiKey) {
    return NextResponse.json(
      { error: "adapterName, displayName, and apiKey are required" },
      { status: 400 }
    );
  }

  const encryptedKey = encrypt(apiKey);
  const encryptedSecret = apiSecret ? encrypt(apiSecret) : null;

  const result = await db.insert(registrarConfigs).values({
    adapterName,
    displayName,
    apiKey: encryptedKey,
    apiSecret: encryptedSecret,
    sandboxMode: sandboxMode ?? true,
    extraConfig: extraConfig ? JSON.stringify(extraConfig) : "{}",
    enabled: true,
  }).returning();

  const config = result[0];
  return NextResponse.json({
    ...config,
    apiKey: maskKey(config.apiKey),
    apiSecret: config.apiSecret ? maskKey(config.apiSecret) : null,
  });
}
