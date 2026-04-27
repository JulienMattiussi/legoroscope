import { Redis } from "@upstash/redis";
import type { Sign } from "@/lib/signs";
import type { StrategyName } from "@/lib/scraper";

const isKvAvailable = () =>
  !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL ?? "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
});

// In-memory fallback for local dev. Attached to global to survive Next.js HMR.
const g = global as typeof global & { _localStore?: Map<string, unknown> };
g._localStore ??= new Map();
const localStore = g._localStore;

export type CachedHoroscope = {
  text: string;
  fetchedAt: string; // ISO date
  strategy: StrategyName | "stale";
  stale?: true;
  sourceUrl?: string;
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
  if (!isKvAvailable()) {
    const cached = localStore.get(weekKey(sign)) as CachedHoroscope | undefined;
    if (cached) return cached;
    const stale = localStore.get(staleKey(sign)) as CachedHoroscope | undefined;
    if (stale) return { ...stale, strategy: "stale", stale: true };
    return null;
  }

  const cached = await kv.get<CachedHoroscope>(weekKey(sign));
  if (cached) return cached;

  const stale = await kv.get<CachedHoroscope>(staleKey(sign));
  if (stale) return { ...stale, strategy: "stale", stale: true };

  return null;
}

export async function setCachedHoroscope(
  sign: Sign,
  data: Omit<CachedHoroscope, "fetchedAt">,
): Promise<void> {
  const entry: CachedHoroscope = { ...data, fetchedAt: new Date().toISOString() };

  if (!isKvAvailable()) {
    localStore.set(weekKey(sign), entry);
    localStore.set(staleKey(sign), entry);
    return;
  }

  await kv.set(weekKey(sign), entry, { ex: WEEK_TTL_SECONDS });
  await kv.set(staleKey(sign), entry);
}

// User pseudos per sign

function userPseudosKey(githubId: string, sign: Sign): string {
  return `user:${githubId}:pseudos:${sign}`;
}

export async function getUserPseudos(githubId: string, sign: Sign): Promise<string[]> {
  if (!isKvAvailable()) return (localStore.get(userPseudosKey(githubId, sign)) as string[]) ?? [];
  return (await kv.get<string[]>(userPseudosKey(githubId, sign))) ?? [];
}

export async function setUserPseudos(
  githubId: string,
  sign: Sign,
  pseudos: string[],
): Promise<void> {
  if (!isKvAvailable()) {
    localStore.set(userPseudosKey(githubId, sign), pseudos);
    return;
  }
  await kv.set(userPseudosKey(githubId, sign), pseudos);
}

// Global pseudo → sign reverse index (pseudos are unique system-wide)

function pseudoSignKey(pseudo: string): string {
  return `pseudo:${pseudo.toLowerCase()}`;
}

export async function getPseudoSign(
  pseudo: string,
): Promise<{ sign: Sign; userId: string } | null> {
  if (!isKvAvailable()) {
    return (localStore.get(pseudoSignKey(pseudo)) as { sign: Sign; userId: string }) ?? null;
  }
  return kv.get<{ sign: Sign; userId: string }>(pseudoSignKey(pseudo));
}

export async function setPseudoSign(pseudo: string, sign: Sign, userId: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.set(pseudoSignKey(pseudo), { sign, userId });
    return;
  }
  await kv.set(pseudoSignKey(pseudo), { sign, userId });
}

export async function deletePseudoSign(pseudo: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.delete(pseudoSignKey(pseudo));
    return;
  }
  await kv.del(pseudoSignKey(pseudo));
}
