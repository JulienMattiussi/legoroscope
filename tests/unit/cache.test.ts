import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockList, mockPut, mockDel, mockFetch } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ list: mockList, put: mockPut, del: mockDel }));

import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
  vi.stubGlobal("fetch", mockFetch);
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
    mockList.mockResolvedValueOnce({ blobs: [{ url: "https://blob/week" }] });
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(ENTRY) });

    const result = await getCachedHoroscope("lion");
    expect(result?.text).toBe("Horoscope test");
    expect(result?.stale).toBeUndefined();
  });

  it("falls back to stale data when weekly key is missing", async () => {
    mockList
      .mockResolvedValueOnce({ blobs: [] }) // weekly miss
      .mockResolvedValueOnce({ blobs: [{ url: "https://blob/stale" }] });
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(STALE) });

    const result = await getCachedHoroscope("lion");
    expect(result?.text).toBe("Vieux horoscope");
    expect(result?.stale).toBe(true);
    expect(result?.strategy).toBe("stale");
  });

  it("returns null when both keys are missing", async () => {
    mockList.mockResolvedValue({ blobs: [] });
    const result = await getCachedHoroscope("lion");
    expect(result).toBeNull();
  });
});

describe("setCachedHoroscope", () => {
  it("writes both weekly key and stale key", async () => {
    mockPut.mockResolvedValue({ url: "https://blob/x" });
    await setCachedHoroscope("scorpion", { text: "Horoscope", strategy: "css" });
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut.mock.calls[0]?.[0]).toMatch(/^horoscope:\d+:\d+:scorpion$/);
    expect(mockPut.mock.calls[1]?.[0]).toBe("horoscope:stale:scorpion");
  });
});
