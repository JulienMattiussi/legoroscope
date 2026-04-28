import Redis from "ioredis";
import type { Sign } from "@/lib/signs";
import type { StrategyName } from "@/lib/scraper";

const isKvAvailable = () => !!process.env.REDIS_URL;

// Singleton: reuses the TCP connection across requests in the same process/warm container.
const g = global as typeof global & { _redisClient?: Redis };
function getRedis(): Redis {
  if (!g._redisClient) {
    g._redisClient = new Redis(process.env.REDIS_URL!);
  }
  return g._redisClient;
}

async function redisGet<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function redisSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds !== undefined) {
    await getRedis().set(key, serialized, "EX", ttlSeconds);
  } else {
    await getRedis().set(key, serialized);
  }
}

async function redisDel(key: string): Promise<void> {
  await getRedis().del(key);
}

// In-memory fallback for local dev (no REDIS_URL). Survives Next.js HMR.
const gStore = global as typeof global & { _localStore?: Map<string, unknown> };
gStore._localStore ??= new Map();
const localStore = gStore._localStore;

export type CachedHoroscope = {
  text: string;
  fetchedAt: string; // ISO date
  strategy: StrategyName | "stale";
  stale?: true;
  sourceUrl?: string;
};

function currentWeekKey(): { year: number; week: number } {
  const now = new Date();
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
  const cached = await redisGet<CachedHoroscope>(weekKey(sign));
  if (cached) return cached;
  const stale = await redisGet<CachedHoroscope>(staleKey(sign));
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
  await redisSet(weekKey(sign), entry, 8 * 24 * 3600);
  await redisSet(staleKey(sign), entry);
}

function userPseudosKey(githubId: string, sign: Sign): string {
  return `user:${githubId}:pseudos:${sign}`;
}

export async function getUserPseudos(githubId: string, sign: Sign): Promise<string[]> {
  if (!isKvAvailable()) return (localStore.get(userPseudosKey(githubId, sign)) as string[]) ?? [];
  return (await redisGet<string[]>(userPseudosKey(githubId, sign))) ?? [];
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
  await redisSet(userPseudosKey(githubId, sign), pseudos);
}

function pseudoSignKey(pseudo: string): string {
  return `pseudo:${pseudo.toLowerCase()}`;
}

export async function getPseudoSign(
  pseudo: string,
): Promise<{ sign: Sign; userId: string } | null> {
  if (!isKvAvailable())
    return (localStore.get(pseudoSignKey(pseudo)) as { sign: Sign; userId: string }) ?? null;
  return redisGet<{ sign: Sign; userId: string }>(pseudoSignKey(pseudo));
}

export async function setPseudoSign(pseudo: string, sign: Sign, userId: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.set(pseudoSignKey(pseudo), { sign, userId });
    return;
  }
  await redisSet(pseudoSignKey(pseudo), { sign, userId });
}

export async function deletePseudoSign(pseudo: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.delete(pseudoSignKey(pseudo));
    return;
  }
  await redisDel(pseudoSignKey(pseudo));
}

export async function getAllPseudoNames(): Promise<string[]> {
  if (!isKvAvailable()) {
    return Array.from(localStore.keys())
      .filter((k) => k.startsWith("pseudo:"))
      .map((k) => k.slice("pseudo:".length));
  }
  const redis = getRedis();
  const names: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "pseudo:*", "COUNT", 100);
    cursor = nextCursor;
    names.push(...keys.map((k) => k.slice("pseudo:".length)));
  } while (cursor !== "0");
  return names;
}
