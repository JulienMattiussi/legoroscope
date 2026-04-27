import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted runs before vi.mock so the same spy instances are shared
// between the mock factory and the test body
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
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getCachedHoroscope", () => {
  it("returns cached data when the weekly key exists", async () => {
    const entry = {
      text: "Horoscope test",
      fetchedAt: new Date().toISOString(),
      strategy: "css" as const,
    };
    mockGet.mockResolvedValueOnce(JSON.stringify(entry));
    const result = await getCachedHoroscope("lion");
    expect(result?.text).toBe("Horoscope test");
    expect(result?.stale).toBeUndefined();
  });

  it("falls back to stale data when weekly key is missing", async () => {
    const stale = {
      text: "Vieux horoscope",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      strategy: "rss" as const,
    };
    mockGet
      .mockResolvedValueOnce(null) // weekly key miss
      .mockResolvedValueOnce(JSON.stringify(stale)); // stale key hit
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
    // First call is the weekly TTL key
    expect(mockSet.mock.calls[0]?.[0]).toMatch(/^horoscope:\d+:\d+:scorpion$/);
    // Second call is the stale key
    expect(mockSet.mock.calls[1]?.[0]).toBe("horoscope:stale:scorpion");
  });
});
