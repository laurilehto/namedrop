import { db } from "./db";
import { domains, domainHistory, registrarConfigs, settings } from "./schema";
import { eq } from "drizzle-orm";
import { sendNotification } from "./notifications";
import { getInitializedAdapter } from "./adapters";
import type { Domain } from "./schema";

export async function attemptAutoRegistration(domain: Domain): Promise<void> {
  // Guard 1: Global auto-register setting
  const globalSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "auto_register_enabled"))
    .get();
  if (globalSetting?.value !== "true") {
    console.log(`[NameDrop] Auto-register disabled globally, skipping ${domain.domain}`);
    return;
  }

  // Guard 2: Domain-level auto-register
  if (!domain.autoRegister) {
    console.log(`[NameDrop] Auto-register not enabled for ${domain.domain}`);
    return;
  }

  // Guard 3: Adapter assigned
  if (!domain.registrarAdapter) {
    console.log(`[NameDrop] No registrar adapter assigned for ${domain.domain}`);
    return;
  }

  // Guard 4: Config exists and is enabled
  const config = await db
    .select()
    .from(registrarConfigs)
    .where(eq(registrarConfigs.adapterName, domain.registrarAdapter))
    .get();
  if (!config || !config.enabled) {
    console.log(`[NameDrop] Registrar config not found or disabled for ${domain.registrarAdapter}`);
    return;
  }

  // Guard 5: Initialize adapter
  const adapter = await getInitializedAdapter(domain.registrarAdapter);
  if (!adapter) {
    console.log(`[NameDrop] Failed to initialize adapter ${domain.registrarAdapter}`);
    return;
  }

  console.log(`[NameDrop] Attempting auto-registration of ${domain.domain} via ${domain.registrarAdapter}`);

  let success = false;
  let error: string | undefined;
  let orderId: string | undefined;
  let cost: number | undefined;
  let currency: string | undefined;

  try {
    const result = await adapter.registerDomain(domain.domain);
    success = result.success;
    error = result.error;
    orderId = result.orderId;
    cost = result.cost;
    currency = result.currency;
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : "Unknown error";
  }

  // Log to domain_history
  const historyResult = await db.insert(domainHistory).values({
    domainId: domain.id,
    fromStatus: domain.currentStatus,
    toStatus: success ? "registered" : domain.currentStatus,
    eventType: "registration_attempt",
    details: JSON.stringify({
      adapter: domain.registrarAdapter,
      success,
      orderId,
      cost,
      currency,
      error,
    }),
  }).returning();

  if (success) {
    // Update domain status to registered
    await db
      .update(domains)
      .set({
        currentStatus: "registered",
        previousStatus: domain.currentStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(domains.id, domain.id));

    console.log(`[NameDrop] Successfully registered ${domain.domain}`);
  } else {
    console.error(`[NameDrop] Failed to register ${domain.domain}: ${error}`);
  }

  // Send registration notification
  const updatedDomain = await db
    .select()
    .from(domains)
    .where(eq(domains.id, domain.id))
    .get();

  if (updatedDomain) {
    try {
      await sendNotification(
        updatedDomain,
        "registration_attempt",
        success ? "registered" : domain.currentStatus,
        domain.currentStatus,
        historyResult[0]?.id
      );
    } catch {
      // Never crash for notification failures
    }
  }

  // Refresh and cache adapter balance
  try {
    const balance = await adapter.getBalance();
    const now = new Date().toISOString();
    await db
      .update(registrarConfigs)
      .set({
        balance: balance.balance,
        balanceUpdated: now,
      })
      .where(eq(registrarConfigs.adapterName, domain.registrarAdapter!));

    // Check low-balance threshold
    const thresholdSetting = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "low_balance_threshold"))
      .get();
    const threshold = parseFloat(thresholdSetting?.value || "10");

    if (balance.balance < threshold) {
      console.warn(
        `[NameDrop] Low balance warning: ${domain.registrarAdapter} balance is ${balance.balance} ${balance.currency} (threshold: ${threshold})`
      );
    }
  } catch {
    // Balance check is non-critical
  }
}
