import { put, list, del, get } from "@vercel/blob";
import type { Sign } from "@/lib/signs";
import type { StrategyName } from "@/lib/scraper";

const isKvAvailable = () => !!process.env.BLOB_READ_WRITE_TOKEN;

async function blobGet<T>(key: string): Promise<T | null> {
  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs.length || blobs[0]!.pathname !== key) return null;
    const res = await get(blobs[0]!.url, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    const text = await new Response(res.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function blobSet(key: string, value: unknown): Promise<void> {
  console.log("[blobSet] key:", key);
  await put(key, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function blobDel(key: string): Promise<void> {
  const { blobs } = await list({ prefix: key, limit: 1 });
  if (blobs.length) await del(blobs[0]!.url);
}

// In-memory fallback for local dev (no BLOB_READ_WRITE_TOKEN). Survives Next.js HMR.
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
  return `horoscope/${year}/${week}/${sign}`;
}

function staleKey(sign: Sign): string {
  return `horoscope/stale/${sign}`;
}

export async function getCachedHoroscope(sign: Sign): Promise<CachedHoroscope | null> {
  if (!isKvAvailable()) {
    const cached = localStore.get(weekKey(sign)) as CachedHoroscope | undefined;
    if (cached) return cached;
    const stale = localStore.get(staleKey(sign)) as CachedHoroscope | undefined;
    if (stale) return { ...stale, strategy: "stale", stale: true };
    return null;
  }
  const cached = await blobGet<CachedHoroscope>(weekKey(sign));
  if (cached) return cached;
  const stale = await blobGet<CachedHoroscope>(staleKey(sign));
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
  await blobSet(weekKey(sign), entry);
  await blobSet(staleKey(sign), entry);
}

function userPseudosKey(githubId: string, sign: Sign): string {
  return `user/${githubId}/pseudos/${sign}`;
}

export async function getUserPseudos(githubId: string, sign: Sign): Promise<string[]> {
  if (!isKvAvailable()) return (localStore.get(userPseudosKey(githubId, sign)) as string[]) ?? [];
  return (await blobGet<string[]>(userPseudosKey(githubId, sign))) ?? [];
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
  await blobSet(userPseudosKey(githubId, sign), pseudos);
}

function pseudoSignKey(pseudo: string): string {
  return `pseudo/${pseudo.toLowerCase()}`;
}

export async function getPseudoSign(
  pseudo: string,
): Promise<{ sign: Sign; userId: string } | null> {
  if (!isKvAvailable())
    return (localStore.get(pseudoSignKey(pseudo)) as { sign: Sign; userId: string }) ?? null;
  return blobGet<{ sign: Sign; userId: string }>(pseudoSignKey(pseudo));
}

export async function setPseudoSign(pseudo: string, sign: Sign, userId: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.set(pseudoSignKey(pseudo), { sign, userId });
    return;
  }
  await blobSet(pseudoSignKey(pseudo), { sign, userId });
}

export async function deletePseudoSign(pseudo: string): Promise<void> {
  if (!isKvAvailable()) {
    localStore.delete(pseudoSignKey(pseudo));
    return;
  }
  await blobDel(pseudoSignKey(pseudo));
}
