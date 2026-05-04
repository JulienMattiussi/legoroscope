import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/cache", () => ({
  getCachedHoroscope: vi.fn(),
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
import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";
import { scrapeAllHoroscopes } from "@/lib/scraper";

function makeRequest(): NextRequest {
  return {} as NextRequest;
}

function makeParams(sign: string) {
  return { params: Promise.resolve({ sign }) };
}

const fresh = (text: string) => ({ text, fetchedAt: "2026-05-04T10:00:00Z", strategy: "css" as const });
const stale = (text: string) => ({ text, fetchedAt: "2026-04-28T10:00:00Z", strategy: "stale" as const, stale: true as const });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/horoscope/[sign] - stale cache triggers scraping", () => {
  it("returns fresh cache without scraping", async () => {
    vi.mocked(getCachedHoroscope).mockResolvedValue(fresh("Horoscope frais."));

    const res = await GET(makeRequest(), makeParams("lion"));
    const body = await res.json();

    expect(body.text).toBe("Horoscope frais.");
    expect(scrapeAllHoroscopes).not.toHaveBeenCalled();
  });

  it("scrapes when cache is stale (new week)", async () => {
    vi.mocked(getCachedHoroscope)
      .mockResolvedValueOnce(stale("Vieux horoscope."))
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

  it("scrapes when cache is absent", async () => {
    vi.mocked(getCachedHoroscope)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(fresh("Horoscope nouveau."));
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({
      lion: { text: "Horoscope nouveau.", strategy: "css", sourceUrl: "http://x" },
    });

    const res = await GET(makeRequest(), makeParams("lion"));
    const body = await res.json();

    expect(scrapeAllHoroscopes).toHaveBeenCalledOnce();
    expect(body.text).toBe("Horoscope nouveau.");
  });
});

describe("GET /api/horoscope/[sign] - alias with stale cache triggers scraping", () => {
  it("scrapes when alias signs have stale cache", async () => {
    const { getAliasIndex } = await import("@/lib/cache");
    vi.mocked(getAliasIndex).mockResolvedValue({ signs: ["lion", "cancer"], userId: "u1" });
    vi.mocked(getCachedHoroscope)
      .mockResolvedValueOnce(stale("Vieux lion."))
      .mockResolvedValueOnce(stale("Vieux cancer."))
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
