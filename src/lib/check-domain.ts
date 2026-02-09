import { db } from "./db";
import { domains, domainHistory, settings } from "./schema";
import { eq } from "drizzle-orm";
import { checkDomain, getCheckIntervalMinutes } from "./rdap";
import type { Domain } from "./schema";

export async function performCheck(domain: Domain) {
  const thresholdSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "expiring_threshold_days"))
    .get();
  const timeoutSetting = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "rdap_timeout_ms"))
    .get();

  const threshold = parseInt(thresholdSetting?.value || "30");
  const timeout = parseInt(timeoutSetting?.value || "10000");

  const result = await checkDomain(domain.domain, domain.tld, threshold, timeout);
  const now = new Date().toISOString();
  const nextCheckMinutes = getCheckIntervalMinutes(result.status);
  const nextCheck = new Date(Date.now() + nextCheckMinutes * 60 * 1000).toISOString();

  await db
    .update(domains)
    .set({
      currentStatus: result.status,
      previousStatus: domain.currentStatus,
      lastChecked: now,
      nextCheck,
      expiryDate: result.expiryDate,
      registrar: result.registrar,
      rdapRaw: result.rdapRaw,
      updatedAt: now,
    })
    .where(eq(domains.id, domain.id));

  if (result.status !== domain.currentStatus) {
    await db.insert(domainHistory).values({
      domainId: domain.id,
      fromStatus: domain.currentStatus,
      toStatus: result.status,
      eventType: "status_change",
      details: JSON.stringify({
        expiryDate: result.expiryDate,
        registrar: result.registrar,
        error: result.error,
      }),
    });
  }

  return { ...result, nextCheck };
}
