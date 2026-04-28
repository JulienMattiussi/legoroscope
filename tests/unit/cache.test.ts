import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGet, mockSet, mockDel } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockReturnValue({ get: mockGet, set: mockSet, del: mockDel }),
}));

import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";

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

  it("falls back to stale data when weekly key is missing", async () => {
    mockGet.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify(STALE));

    const result = await getCachedHoroscope("lion");
    expect(result?.text).toBe("Vieux horoscope");
    expect(result?.stale).toBe(true);
    expect(result?.strategy).toBe("stale");
  });

  it("returns null when both keys are missing", async () => {
    mockGet.mockResolvedValue(null);
    const result = await getCachedHoroscope("lion");
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
    // weekly key: set(key, value, "EX", seconds)
    expect(mockSet.mock.calls[0]?.[2]).toBe("EX");
    expect(mockSet.mock.calls[0]?.[3]).toBeGreaterThan(0);
    // stale key: set(key, value) — no TTL args
    expect(mockSet.mock.calls[1]?.[2]).toBeUndefined();
  });
});
