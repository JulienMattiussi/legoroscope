import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/cache", () => ({
  getCachedHoroscope: vi.fn(),
  getStaleCachedHoroscope: vi.fn().mockResolvedValue(null),
  setCachedHoroscope: vi.fn().mockResolvedValue(undefined),
  getAliasIndex: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/scraper", () => ({
  scrapeAllHoroscopes: vi.fn(),
  ScrapingError: class ScrapingError extends Error {
    constructor(sign: string) {
      super(sign);
      this.name = "ScrapingError";
    }
  },
}));

import { GET } from "@/app/api/horoscope/[sign]/route";
import { getCachedHoroscope, getStaleCachedHoroscope, setCachedHoroscope } from "@/lib/cache";
import { scrapeAllHoroscopes } from "@/lib/scraper";

function makeRequest(): NextRequest {
  return {} as NextRequest;
}

function makeParams(sign: string) {
  return { params: Promise.resolve({ sign }) };
}

const fresh = (text: string) => ({
  text,
  fetchedAt: "2026-05-04T10:00:00Z",
  strategy: "css" as const,
});
const stale = (text: string) => ({
  text,
  fetchedAt: "2026-04-28T10:00:00Z",
  strategy: "stale" as const,
  stale: true as const,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/horoscope/[sign] - cache miss triggers scraping", () => {
  it("returns fresh cache without scraping", async () => {
    vi.mocked(getCachedHoroscope).mockResolvedValue(fresh("Horoscope frais."));

    const res = await GET(makeRequest(), makeParams("lion"));
    const body = await res.json();

    expect(body.text).toBe("Horoscope frais.");
    expect(scrapeAllHoroscopes).not.toHaveBeenCalled();
  });

  it("scrapes when cache is absent (new week)", async () => {
    vi.mocked(getCachedHoroscope)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(fresh("Horoscope semaine courante."));
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({
      lion: { text: "Horoscope semaine courante.", strategy: "css", sourceUrl: "http://x" },
    });

    const res = await GET(makeRequest(), makeParams("lion"));
    const body = await res.json();

    expect(scrapeAllHoroscopes).toHaveBeenCalledOnce();
    expect(setCachedHoroscope).toHaveBeenCalled();
    expect(body.text).toBe("Horoscope semaine courante.");
  });

  it("returns stale data when scraping fails", async () => {
    vi.mocked(getCachedHoroscope).mockResolvedValue(null);
    vi.mocked(getStaleCachedHoroscope).mockResolvedValue(stale("Vieux horoscope."));
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({});

    const res = await GET(makeRequest(), makeParams("lion"));
    const body = await res.json();

    expect(body.text).toBe("Vieux horoscope.");
    expect(body.stale).toBe(true);
  });
});

describe("GET /api/horoscope/[sign] - alias", () => {
  it("scrapes when alias signs are absent from cache", async () => {
    const { getAliasIndex } = await import("@/lib/cache");
    vi.mocked(getAliasIndex).mockResolvedValue({ signs: ["lion", "cancer"], userId: "u1" });
    vi.mocked(getCachedHoroscope)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(fresh("Horoscope à jour."));
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({
      lion: { text: "Lion à jour.", strategy: "css", sourceUrl: "http://x" },
      cancer: { text: "Cancer à jour.", strategy: "css", sourceUrl: "http://x" },
    });

    const res = await GET(makeRequest(), makeParams("monalias"));
    expect(res.status).toBe(200);
    expect(scrapeAllHoroscopes).toHaveBeenCalledOnce();
  });

  it("does not scrape when alias signs all have fresh cache", async () => {
    const { getAliasIndex } = await import("@/lib/cache");
    vi.mocked(getAliasIndex).mockResolvedValue({ signs: ["lion", "cancer"], userId: "u1" });
    vi.mocked(getCachedHoroscope).mockResolvedValue(fresh("Horoscope frais."));

    const res = await GET(makeRequest(), makeParams("monalias"));
    expect(res.status).toBe(200);
    expect(scrapeAllHoroscopes).not.toHaveBeenCalled();
  });
});
