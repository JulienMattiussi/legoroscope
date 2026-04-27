import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGet, mockPut, mockDel, mockList } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({ get: mockGet, put: mockPut, del: mockDel, list: mockList }));

import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
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

function makeStream(data: unknown): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  return new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
}

function blobFound(data: unknown) {
  return { statusCode: 200 as const, stream: makeStream(data), headers: new Headers(), blob: {} };
}

describe("getCachedHoroscope", () => {
  it("returns cached data when the weekly key exists", async () => {
    mockGet.mockResolvedValueOnce(blobFound(ENTRY));

    const result = await getCachedHoroscope("lion");
    expect(result?.text).toBe("Horoscope test");
    expect(result?.stale).toBeUndefined();
  });

  it("falls back to stale data when weekly key is missing", async () => {
    mockGet
      .mockResolvedValueOnce(null) // weekly miss
      .mockResolvedValueOnce(blobFound(STALE));

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
    mockPut.mockResolvedValue({ url: "https://blob/x" });
    await setCachedHoroscope("scorpion", { text: "Horoscope", strategy: "css" });
    expect(mockPut).toHaveBeenCalledTimes(2);
    expect(mockPut.mock.calls[0]?.[0]).toMatch(/^horoscope:\d+:\d+:scorpion$/);
    expect(mockPut.mock.calls[1]?.[0]).toBe("horoscope:stale:scorpion");
  });
});
