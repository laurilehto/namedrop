import type { RegistrarAdapter } from "./types";
import { DynadotAdapter } from "./dynadot/adapter";
import { NamecheapAdapter } from "./namecheap/adapter";
import { GandiAdapter } from "./gandi/adapter";
import { db } from "../db";
import { registrarConfigs } from "../schema";
import { eq } from "drizzle-orm";
import { decrypt } from "../crypto";

const adapterFactories: Record<string, () => RegistrarAdapter> = {
  dynadot: () => new DynadotAdapter(),
  namecheap: () => new NamecheapAdapter(),
  gandi: () => new GandiAdapter(),
};

export function listAdapterTypes(): Array<{
  name: string;
  displayName: string;
  configSchema: RegistrarAdapter["configSchema"];
}> {
  return Object.entries(adapterFactories).map(([name, factory]) => {
    const adapter = factory();
    return {
      name,
      displayName: adapter.displayName,
      configSchema: adapter.configSchema,
    };
  });
}

export function createAdapter(name: string): RegistrarAdapter | null {
  const factory = adapterFactories[name];
  return factory ? factory() : null;
}

export async function getInitializedAdapter(
  adapterName: string
): Promise<RegistrarAdapter | null> {
  const config = await db
    .select()
    .from(registrarConfigs)
    .where(eq(registrarConfigs.adapterName, adapterName))
    .get();

  if (!config) return null;

  const adapter = createAdapter(adapterName);
  if (!adapter) return null;

  let extraConfig: Record<string, unknown> = {};
  try {
    extraConfig = JSON.parse(config.extraConfig || "{}");
  } catch {
    // ignore
  }

  adapter.initialize({
    apiKey: decrypt(config.apiKey),
    apiSecret: config.apiSecret ? decrypt(config.apiSecret) : undefined,
    sandboxMode: config.sandboxMode ?? true,
    extraConfig,
  });

  return adapter;
}
