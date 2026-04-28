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

// ---------------------------------------------------------------------------
// Aliases
// An alias maps a user-defined name to one or more zodiac signs.
// Key schema:
//   user:{githubId}:alias:{lowerName} → Sign[]          (user-scoped list of signs)
//   alias:{lowerName}                 → {signs, userId}  (global reverse index)
// ---------------------------------------------------------------------------

export type AliasEntry = { signs: Sign[]; userId: string };

function userAliasKey(githubId: string, aliasName: string): string {
  return `user:${githubId}:alias:${aliasName.toLowerCase()}`;
}

function aliasIndexKey(aliasName: string): string {
  return `alias:${aliasName.toLowerCase()}`;
}

export async function getUserAlias(githubId: string, aliasName: string): Promise<Sign[] | null> {
  if (!isKvAvailable())
    return (localStore.get(userAliasKey(githubId, aliasName)) as Sign[]) ?? null;
  return redisGet<Sign[]>(userAliasKey(githubId, aliasName));
}

export async function setUserAlias(
  githubId: string,
  aliasName: string,
  signs: Sign[],
): Promise<void> {
  if (!isKvAvailable()) {
    localStore.set(userAliasKey(githubId, aliasName), signs);
    return;
  }
  await redisSet(userAliasKey(githubId, aliasName), signs);
}

export async function deleteUserAlias(githubId: string, aliasName: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.delete(userAliasKey(githubId, aliasName));
    return;
  }
  await redisDel(userAliasKey(githubId, aliasName));
}

export async function getAliasIndex(aliasName: string): Promise<AliasEntry | null> {
  if (!isKvAvailable()) return (localStore.get(aliasIndexKey(aliasName)) as AliasEntry) ?? null;
  return redisGet<AliasEntry>(aliasIndexKey(aliasName));
}

export async function setAliasIndex(
  aliasName: string,
  signs: Sign[],
  userId: string,
): Promise<void> {
  if (!isKvAvailable()) {
    localStore.set(aliasIndexKey(aliasName), { signs, userId });
    return;
  }
  await redisSet(aliasIndexKey(aliasName), { signs, userId });
}

export async function deleteAliasIndex(aliasName: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.delete(aliasIndexKey(aliasName));
    return;
  }
  await redisDel(aliasIndexKey(aliasName));
}

export async function getAllAliasNames(): Promise<string[]> {
  if (!isKvAvailable()) {
    return Array.from(localStore.keys())
      .filter((k) => k.startsWith("alias:"))
      .map((k) => k.slice("alias:".length));
  }
  const redis = getRedis();
  const names: string[] = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "alias:*", "COUNT", 100);
    cursor = nextCursor;
    names.push(...keys.map((k) => k.slice("alias:".length)));
  } while (cursor !== "0");
  return names;
}

export async function getAllUserAliases(githubId: string): Promise<Record<string, Sign[]>> {
  if (!isKvAvailable()) {
    const prefix = `user:${githubId}:alias:`;
    const result: Record<string, Sign[]> = {};
    for (const [key, value] of localStore.entries()) {
      if (key.startsWith(prefix)) {
        result[key.slice(prefix.length)] = value as Sign[];
      }
    }
    return result;
  }
  const redis = getRedis();
  const keys: string[] = [];
  let cursor = "0";
  const pattern = `user:${githubId}:alias:*`;
  do {
    const [nextCursor, found] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;
    keys.push(...found);
  } while (cursor !== "0");
  if (keys.length === 0) return {};
  const prefix = `user:${githubId}:alias:`;
  const values = await Promise.all(keys.map((k) => redisGet<Sign[]>(k)));
  const result: Record<string, Sign[]> = {};
  keys.forEach((k, i) => {
    const signs = values[i];
    if (signs) result[k.slice(prefix.length)] = signs;
  });
  return result;
}
