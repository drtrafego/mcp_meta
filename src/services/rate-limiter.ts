/**
 * Rate limiter for Meta Graph API.
 * Tracks usage per ad account, enforces delays between bulk operations,
 * and implements exponential backoff on 429 responses.
 */

interface AccountUsage {
  callCount: number;
  totalCpuTime: number;
  totalTime: number;
  lastReset: number;
  throttledUntil: number;
}

const accountUsage = new Map<string, AccountUsage>();

/** Delay in ms between sequential bulk API calls */
export const BULK_DELAY_MS = 300;

/** Maximum items in a single bulk operation */
export const MAX_BULK_ITEMS = 50;

/** Maximum retry attempts on rate limit (429) */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff in ms */
const BASE_BACKOFF_MS = 5000;

/**
 * Parse rate limit headers from Meta API response.
 * Updates internal tracking per account.
 */
export function parseRateLimitHeaders(
  headers: Record<string, string | string[] | undefined>,
  accountId?: string
): void {
  const appUsage = headers["x-app-usage"] || headers["X-App-Usage"];
  const bizUsage =
    headers["x-business-use-case-usage"] || headers["X-Business-Use-Case-Usage"];

  if (appUsage) {
    try {
      const parsed = JSON.parse(typeof appUsage === "string" ? appUsage : appUsage[0]);
      const key = accountId || "__app__";
      accountUsage.set(key, {
        callCount: parsed.call_count || 0,
        totalCpuTime: parsed.total_cputime || 0,
        totalTime: parsed.total_time || 0,
        lastReset: Date.now(),
        throttledUntil: parsed.call_count >= 80 ? Date.now() + 60000 : 0,
      });
    } catch {
      // ignore parse errors
    }
  }

  if (bizUsage) {
    try {
      const parsed = JSON.parse(typeof bizUsage === "string" ? bizUsage : bizUsage[0]);
      for (const [bizId, usageArr] of Object.entries(parsed)) {
        const usage = Array.isArray(usageArr) ? (usageArr as any[])[0] : usageArr as any;
        if (usage) {
          accountUsage.set(bizId, {
            callCount: usage.call_count || 0,
            totalCpuTime: usage.total_cputime || 0,
            totalTime: usage.total_time || 0,
            lastReset: Date.now(),
            throttledUntil:
              usage.call_count >= 80
                ? Date.now() + (usage.estimated_time_to_regain_access || 60) * 1000
                : 0,
          });
        }
      }
    } catch {
      // ignore parse errors
    }
  }
}

/**
 * Check if we should throttle requests for a given account.
 * Returns the number of ms to wait, or 0 if OK to proceed.
 */
export function getThrottleDelay(accountId?: string): number {
  const key = accountId || "__app__";
  const usage = accountUsage.get(key);
  if (!usage) return 0;

  if (usage.throttledUntil > Date.now()) {
    return usage.throttledUntil - Date.now();
  }

  // Proactive slowdown: if usage > 60%, add small delay
  if (usage.callCount > 60) {
    return Math.min((usage.callCount - 60) * 50, 5000);
  }

  return 0;
}

/**
 * Sleep for the given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with rate limit awareness and exponential backoff.
 * Retries on 429 errors up to MAX_RETRIES times.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  accountId?: string
): Promise<T> {
  // Check proactive throttle
  const throttleDelay = getThrottleDelay(accountId);
  if (throttleDelay > 0) {
    await sleep(throttleDelay);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const errorCode = error?.response?.data?.error?.code;

      // Only retry on rate limit errors (429 or Meta error codes 4, 17, 32, 80000, 80003, 80004)
      const isRateLimit =
        status === 429 ||
        errorCode === 4 ||
        errorCode === 17 ||
        errorCode === 32 ||
        errorCode === 80000 ||
        errorCode === 80003 ||
        errorCode === 80004;

      if (!isRateLimit || attempt === MAX_RETRIES) {
        throw error;
      }

      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, attempt);
      console.warn(
        `[RATE LIMIT] Hit rate limit (code=${errorCode || status}). ` +
          `Retry ${attempt + 1}/${MAX_RETRIES} after ${backoffMs}ms`
      );

      // Mark account as throttled
      if (accountId) {
        accountUsage.set(accountId, {
          callCount: 100,
          totalCpuTime: 100,
          totalTime: 100,
          lastReset: Date.now(),
          throttledUntil: Date.now() + backoffMs,
        });
      }

      await sleep(backoffMs);
    }
  }

  throw lastError;
}
