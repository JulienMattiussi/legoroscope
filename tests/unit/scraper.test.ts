import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  scrapeAllHoroscopes,
  scrapeHoroscope,
  ScrapingError,
  getMissingSigns,
} from "@/lib/scraper";

vi.mock("@/lib/scraper/css", () => ({ scrapeAllWithCSS: vi.fn() }));
vi.mock("@/lib/scraper/rss", () => ({ scrapeAllWithRSS: vi.fn() }));
vi.mock("@/lib/scraper/regex", () => ({ scrapeAllWithRegex: vi.fn() }));

import { scrapeAllWithCSS } from "@/lib/scraper/css";
import { scrapeAllWithRSS } from "@/lib/scraper/rss";
import { scrapeAllWithRegex } from "@/lib/scraper/regex";

const mockCSS = vi.mocked(scrapeAllWithCSS);
const mockRSS = vi.mocked(scrapeAllWithRSS);
const mockRegex = vi.mocked(scrapeAllWithRegex);

const ALL_SIGNS_RESULT = {
  belier: "Les astres.",
  taureau: "Les astres.",
  gemeaux: "Les astres.",
  cancer: "Les astres.",
  lion: "Les astres.",
  vierge: "Les astres.",
  balance: "Les astres.",
  scorpion: "Les astres.",
  sagittaire: "Les astres.",
  capricorne: "Les astres.",
  verseau: "Les astres.",
  poissons: "Les astres.",
  furet: "Les astres.",
};

beforeEach(() => vi.clearAllMocks());

const wrap = (
  results: typeof ALL_SIGNS_RESULT | Partial<typeof ALL_SIGNS_RESULT>,
  sourceUrl?: string,
) => ({ results, sourceUrl });

describe("scrapeAllHoroscopes", () => {
  it("returns all signs when CSS strategy succeeds", async () => {
    mockCSS.mockResolvedValue(wrap(ALL_SIGNS_RESULT, "https://example.com/article"));
    const results = await scrapeAllHoroscopes();
    expect(Object.keys(results)).toHaveLength(13);
    expect(results.lion?.strategy).toBe("css");
    expect(results.lion?.sourceUrl).toBe("https://example.com/article");
    expect(mockRSS).not.toHaveBeenCalled();
  });

  it("falls back to RSS when CSS returns fewer than 6 signs", async () => {
    mockCSS.mockResolvedValue(wrap({ lion: "Texte." }));
    mockRSS.mockResolvedValue(wrap(ALL_SIGNS_RESULT));
    const results = await scrapeAllHoroscopes();
    expect(results.lion?.strategy).toBe("rss");
    expect(mockRegex).not.toHaveBeenCalled();
  });

  it("falls back to regex when CSS and RSS both return too few signs", async () => {
    mockCSS.mockResolvedValue(wrap({}));
    mockRSS.mockResolvedValue(wrap({ scorpion: "Texte." }));
    mockRegex.mockResolvedValue(wrap(ALL_SIGNS_RESULT));
    const results = await scrapeAllHoroscopes();
    expect(results.scorpion?.strategy).toBe("regex");
  });

  it("falls back to next strategy when a strategy throws", async () => {
    mockCSS.mockRejectedValue(new Error("Network error"));
    mockRSS.mockResolvedValue(wrap(ALL_SIGNS_RESULT));
    const results = await scrapeAllHoroscopes();
    expect(results.lion?.strategy).toBe("rss");
  });

  it("returns empty object when all strategies fail", async () => {
    mockCSS.mockResolvedValue(wrap({}));
    mockRSS.mockResolvedValue(wrap({}));
    mockRegex.mockResolvedValue(wrap({}));
    const results = await scrapeAllHoroscopes();
    expect(Object.keys(results)).toHaveLength(0);
  });

  it("trims whitespace from results", async () => {
    mockCSS.mockResolvedValue(wrap({ lion: "  Texte avec espaces.  " }));
    mockRSS.mockResolvedValue(wrap(ALL_SIGNS_RESULT)); // CSS only has 1 sign, falls back to RSS
    const results = await scrapeAllHoroscopes();
    // RSS had the full set so it wins
    expect(results.lion?.text).toBe("Les astres.");
  });
});

describe("scrapeHoroscope (single sign)", () => {
  it("returns result for the requested sign", async () => {
    mockCSS.mockResolvedValue(wrap(ALL_SIGNS_RESULT));
    const result = await scrapeHoroscope("lion");
    expect(result.text).toBe("Les astres.");
    expect(result.strategy).toBe("css");
  });

  it("throws ScrapingError when the sign is missing from all strategy results", async () => {
    mockCSS.mockResolvedValue(wrap({}));
    mockRSS.mockResolvedValue(wrap({}));
    mockRegex.mockResolvedValue(wrap({}));
    await expect(scrapeHoroscope("lion")).rejects.toThrow(ScrapingError);
  });
});

describe("getMissingSigns", () => {
  it("returns signs not present in the cached map", () => {
    const missing = getMissingSigns({ lion: { text: "ok" }, scorpion: { text: "ok" } });
    expect(missing).not.toContain("lion");
    expect(missing).not.toContain("scorpion");
    expect(missing).toContain("belier");
    expect(missing).toHaveLength(11);
  });

  it("returns all signs when cache is empty", () => {
    expect(getMissingSigns({})).toHaveLength(13);
  });
});
