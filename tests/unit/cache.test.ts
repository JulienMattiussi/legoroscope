import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGet, mockSet, mockDel, mockScan } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
  mockScan: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockReturnValue({ get: mockGet, set: mockSet, del: mockDel, scan: mockScan }),
}));

import {
  getCachedHoroscope,
  getStaleCachedHoroscope,
  setCachedHoroscope,
  getUserAlias,
  setUserAlias,
  deleteUserAlias,
  getAliasIndex,
  setAliasIndex,
  deleteAliasIndex,
  getAllAliasNames,
  getAllUserAliases,
} from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("REDIS_URL", "redis://default:test@localhost:6379");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const ENTRY = {
  text: "Horoscope test",
  fetchedAt: new Date().toISOString(),
  strategy: "css" as const,
};

const STALE = {
  text: "Vieux horoscope",
  fetchedAt: "2026-01-01T00:00:00.000Z",
  strategy: "rss" as const,
};

describe("getCachedHoroscope", () => {
  it("returns cached data when the weekly key exists", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(ENTRY));

    const result = await getCachedHoroscope("lion");
    expect(result?.text).toBe("Horoscope test");
    expect(result?.stale).toBeUndefined();
  });

  it("returns null when weekly key is missing (no stale fallback)", async () => {
    mockGet.mockResolvedValue(null);
    const result = await getCachedHoroscope("lion");
    expect(result).toBeNull();
  });
});

describe("getStaleCachedHoroscope", () => {
  it("returns stale data when stale key is present", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(STALE));

    const result = await getStaleCachedHoroscope("lion");
    expect(result?.text).toBe("Vieux horoscope");
    expect(result?.stale).toBe(true);
    expect(result?.strategy).toBe("stale");
  });

  it("returns null when stale key is missing", async () => {
    mockGet.mockResolvedValue(null);
    const result = await getStaleCachedHoroscope("lion");
    expect(result).toBeNull();
  });
});

describe("setCachedHoroscope", () => {
  it("writes both weekly key and stale key", async () => {
    mockSet.mockResolvedValue("OK");
    await setCachedHoroscope("scorpion", { text: "Horoscope", strategy: "css" });
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet.mock.calls[0]?.[0]).toMatch(/^horoscope:\d+:\d+:scorpion$/);
    expect(mockSet.mock.calls[1]?.[0]).toBe("horoscope:stale:scorpion");
  });

  it("sets a TTL on the weekly key but not the stale key", async () => {
    mockSet.mockResolvedValue("OK");
    await setCachedHoroscope("lion", { text: "Horoscope", strategy: "css" });
    expect(mockSet.mock.calls[0]?.[2]).toBe("EX");
    expect(mockSet.mock.calls[0]?.[3]).toBeGreaterThan(0);
    expect(mockSet.mock.calls[1]?.[2]).toBeUndefined();
  });
});

describe("alias functions (Redis)", () => {
  it("setUserAlias writes the correct key", async () => {
    mockSet.mockResolvedValue("OK");
    await setUserAlias("u1", "Michel", ["lion", "belier"]);
    expect(mockSet).toHaveBeenCalledWith(
      "user:u1:alias:michel",
      JSON.stringify(["lion", "belier"]),
    );
  });

  it("getUserAlias reads the correct key", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify(["lion"]));
    const result = await getUserAlias("u1", "Michel");
    expect(mockGet).toHaveBeenCalledWith("user:u1:alias:michel");
    expect(result).toEqual(["lion"]);
  });

  it("getUserAlias returns null when key is missing", async () => {
    mockGet.mockResolvedValueOnce(null);
    expect(await getUserAlias("u1", "unknown")).toBeNull();
  });

  it("deleteUserAlias deletes the correct key", async () => {
    mockDel.mockResolvedValue(1);
    await deleteUserAlias("u1", "Michel");
    expect(mockDel).toHaveBeenCalledWith("user:u1:alias:michel");
  });

  it("setAliasIndex writes to the global index", async () => {
    mockSet.mockResolvedValue("OK");
    await setAliasIndex("Michel", ["lion"], "u1");
    expect(mockSet).toHaveBeenCalledWith(
      "alias:michel",
      JSON.stringify({ signs: ["lion"], userId: "u1" }),
    );
  });

  it("getAliasIndex reads from the global index", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ signs: ["lion", "belier"], userId: "u1" }));
    const result = await getAliasIndex("Michel");
    expect(mockGet).toHaveBeenCalledWith("alias:michel");
    expect(result).toEqual({ signs: ["lion", "belier"], userId: "u1" });
  });

  it("deleteAliasIndex deletes the global index key", async () => {
    mockDel.mockResolvedValue(1);
    await deleteAliasIndex("Michel");
    expect(mockDel).toHaveBeenCalledWith("alias:michel");
  });
});

describe("getAllAliasNames", () => {
  it("returns alias names extracted from Redis keys", async () => {
    mockScan.mockResolvedValueOnce(["0", ["alias:michel", "alias:caroline"]]);
    const names = await getAllAliasNames();
    expect(names).toEqual(["michel", "caroline"]);
    expect(mockScan).toHaveBeenCalledWith("0", "MATCH", "alias:*", "COUNT", 100);
  });

  it("iterates until cursor is 0", async () => {
    mockScan
      .mockResolvedValueOnce(["42", ["alias:michel"]])
      .mockResolvedValueOnce(["0", ["alias:caroline"]]);
    const names = await getAllAliasNames();
    expect(names).toEqual(["michel", "caroline"]);
    expect(mockScan).toHaveBeenCalledTimes(2);
  });

  it("returns empty array when no alias keys exist", async () => {
    mockScan.mockResolvedValueOnce(["0", []]);
    expect(await getAllAliasNames()).toEqual([]);
  });
});

describe("getAllUserAliases", () => {
  it("returns a map of alias name to signs", async () => {
    mockScan.mockResolvedValueOnce(["0", ["user:u1:alias:michel", "user:u1:alias:caroline"]]);
    mockGet
      .mockResolvedValueOnce(JSON.stringify(["lion"]))
      .mockResolvedValueOnce(JSON.stringify(["belier", "verseau"]));
    const result = await getAllUserAliases("u1");
    expect(result).toEqual({ michel: ["lion"], caroline: ["belier", "verseau"] });
  });

  it("returns empty object when user has no aliases", async () => {
    mockScan.mockResolvedValueOnce(["0", []]);
    expect(await getAllUserAliases("u1")).toEqual({});
  });
});

describe("local store fallback (no REDIS_URL)", () => {
  const g = global as typeof global & { _localStore?: Map<string, unknown> };

  beforeEach(() => {
    vi.unstubAllEnvs();
    delete process.env.REDIS_URL;
    g._localStore?.clear();
  });

  it("getCachedHoroscope returns null when store is empty", async () => {
    expect(await getCachedHoroscope("lion")).toBeNull();
  });

  it("setCachedHoroscope + getCachedHoroscope round-trips the entry", async () => {
    await setCachedHoroscope("belier", { text: "Prédiction", strategy: "css" });
    const result = await getCachedHoroscope("belier");
    expect(result?.text).toBe("Prédiction");
    expect(result?.stale).toBeUndefined();
  });

  it("getStaleCachedHoroscope returns stale when weekly key absent but stale key present", async () => {
    await setCachedHoroscope("taureau", { text: "Ancien horoscope", strategy: "rss" });
    const now = new Date();
    const jan4 = new Date(now.getFullYear(), 0, 4);
    const startOfWeek1 = new Date(jan4);
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const diff = now.getTime() - startOfWeek1.getTime();
    const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
    g._localStore?.delete(`horoscope:${now.getFullYear()}:${week}:taureau`);
    expect(await getCachedHoroscope("taureau")).toBeNull();
    const result = await getStaleCachedHoroscope("taureau");
    expect(result?.text).toBe("Ancien horoscope");
    expect(result?.stale).toBe(true);
  });

  it("setUserAlias + getUserAlias round-trips the signs list", async () => {
    await setUserAlias("u1", "Michel", ["lion", "belier"]);
    expect(await getUserAlias("u1", "Michel")).toEqual(["lion", "belier"]);
  });

  it("getUserAlias is case-insensitive on the name", async () => {
    await setUserAlias("u1", "MICHEL", ["lion"]);
    expect(await getUserAlias("u1", "michel")).toEqual(["lion"]);
  });

  it("deleteUserAlias removes the entry", async () => {
    await setUserAlias("u1", "Michel", ["lion"]);
    await deleteUserAlias("u1", "Michel");
    expect(await getUserAlias("u1", "Michel")).toBeNull();
  });

  it("setAliasIndex + getAliasIndex round-trips the entry", async () => {
    await setAliasIndex("Michel", ["lion", "cancer"], "u1");
    expect(await getAliasIndex("Michel")).toEqual({ signs: ["lion", "cancer"], userId: "u1" });
  });

  it("deleteAliasIndex removes the entry", async () => {
    await setAliasIndex("Michel", ["lion"], "u1");
    await deleteAliasIndex("Michel");
    expect(await getAliasIndex("Michel")).toBeNull();
  });

  it("getAllAliasNames returns names from local store", async () => {
    await setAliasIndex("michel", ["lion"], "u1");
    await setAliasIndex("caroline", ["belier"], "u1");
    g._localStore?.set("other:key", "ignored");
    const names = await getAllAliasNames();
    expect(names).toContain("michel");
    expect(names).toContain("caroline");
    expect(names).not.toContain("other:key");
  });

  it("getAllUserAliases returns all aliases for a user", async () => {
    await setUserAlias("u1", "michel", ["lion"]);
    await setUserAlias("u1", "caroline", ["belier", "verseau"]);
    await setUserAlias("u2", "other", ["cancer"]); // different user, excluded
    const result = await getAllUserAliases("u1");
    expect(result).toEqual({ michel: ["lion"], caroline: ["belier", "verseau"] });
  });
});
