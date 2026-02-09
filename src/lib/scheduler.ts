import * as cron from "node-cron";
import { db } from "./db";
import { domains, domainHistory, settings } from "./schema";
import { eq, lte, or, isNull } from "drizzle-orm";
import { checkDomain, getCheckIntervalMinutes } from "./rdap";

interface SchedulerState {
  task: ReturnType<typeof cron.schedule> | null;
  isRunning: boolean;
  lastRun: string | null;
  lastResult: { checked: number; changed: number; errors: number } | null;
}

const globalState = globalThis as unknown as { __namedrop_scheduler?: SchedulerState };
if (!globalState.__namedrop_scheduler) {
  globalState.__namedrop_scheduler = {
    task: null,
    isRunning: false,
    lastRun: null,
    lastResult: null,
  };
}
const state = globalState.__namedrop_scheduler;

export function getSchedulerStatus() {
  return {
    running: state.isRunning,
    active: state.task !== null,
    lastRun: state.lastRun,
    lastResult: state.lastResult,
  };
}

export async function runSchedulerCheck() {
  if (state.isRunning) {
    return { skipped: true, reason: "Already running" };
  }

  state.isRunning = true;
  const result = { checked: 0, changed: 0, errors: 0 };

  try {
    const now = new Date().toISOString();

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

    const domainsToCheck = await db
      .select()
      .from(domains)
      .where(or(lte(domains.nextCheck, now), isNull(domains.nextCheck)));

    for (const domain of domainsToCheck) {
      try {
        const checkResult = await checkDomain(domain.domain, domain.tld, threshold, timeout);
        result.checked++;

        const nextCheckMinutes = getCheckIntervalMinutes(checkResult.status);
        const nextCheck = new Date(Date.now() + nextCheckMinutes * 60 * 1000).toISOString();

        await db
          .update(domains)
          .set({
            currentStatus: checkResult.status,
            previousStatus: domain.currentStatus,
            lastChecked: now,
            nextCheck,
            expiryDate: checkResult.expiryDate,
            registrar: checkResult.registrar,
            rdapRaw: checkResult.rdapRaw,
            updatedAt: now,
          })
          .where(eq(domains.id, domain.id));

        if (checkResult.status !== domain.currentStatus) {
          result.changed++;
          await db.insert(domainHistory).values({
            domainId: domain.id,
            fromStatus: domain.currentStatus,
            toStatus: checkResult.status,
            eventType: "status_change",
            details: JSON.stringify({
              expiryDate: checkResult.expiryDate,
              registrar: checkResult.registrar,
            }),
          });
        }
      } catch {
        result.errors++;
      }
    }
  } finally {
    state.isRunning = false;
    state.lastRun = new Date().toISOString();
    state.lastResult = result;
  }

  return result;
}

export function startScheduler() {
  if (state.task) return;

  state.task = cron.schedule("* * * * *", async () => {
    await runSchedulerCheck();
  });

  console.log("[NameDrop] Scheduler started");
}

export function stopScheduler() {
  if (state.task) {
    state.task.stop();
    state.task = null;
    console.log("[NameDrop] Scheduler stopped");
  }
}
