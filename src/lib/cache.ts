import { kv } from "@vercel/kv";
import type { Sign } from "@/lib/signs";
import type { StrategyName } from "@/lib/scraper";

export type CachedHoroscope = {
  text: string;
  fetchedAt: string; // ISO date
  strategy: StrategyName | "stale";
  stale?: true;
};

// A week TTL with a small buffer so Monday re-fetches work cleanly
const WEEK_TTL_SECONDS = 7 * 24 * 60 * 60 + 3600;

function currentWeekKey(): { year: number; week: number } {
  const now = new Date();
  // ISO week number
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = now.getTime() - startOfWeek1.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { year: now.getFullYear(), week };
}

function weekKey(sign: Sign): string {
  const { year, week } = currentWeekKey();
  return `horoscope:${year}:${week}:${sign}`;
}

function staleKey(sign: Sign): string {
  return `horoscope:stale:${sign}`;
}

export async function getCachedHoroscope(sign: Sign): Promise<CachedHoroscope | null> {
  const cached = await kv.get<CachedHoroscope>(weekKey(sign));
  if (cached) return cached;

  // Fall back to stale data if this week has no cache yet
  const stale = await kv.get<CachedHoroscope>(staleKey(sign));
  if (stale) return { ...stale, strategy: "stale", stale: true };

  return null;
}

export async function setCachedHoroscope(
  sign: Sign,
  data: Omit<CachedHoroscope, "fetchedAt">,
): Promise<void> {
  const entry: CachedHoroscope = { ...data, fetchedAt: new Date().toISOString() };
  await kv.set(weekKey(sign), entry, { ex: WEEK_TTL_SECONDS });
  // Always update stale fallback with latest good data
  await kv.set(staleKey(sign), entry);
}

// User ↔ sign associations

function userSignKey(githubId: string): string {
  return `user:${githubId}:sign`;
}

export async function getUserSign(githubId: string): Promise<Sign | null> {
  return kv.get<Sign>(userSignKey(githubId));
}

export async function setUserSign(githubId: string, sign: Sign): Promise<void> {
  await kv.set(userSignKey(githubId), sign);
}
