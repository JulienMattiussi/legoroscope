import type { Sign } from "@/lib/signs";
import { SIGN_SLUGS } from "@/lib/signs";
import { GORAFI_CONFIG } from "@/lib/gorafi.config";
import { scrapeAllWithCSS } from "./css";
import { scrapeAllWithRSS } from "./rss";
import { scrapeAllWithRegex } from "./regex";

export type StrategyName = "css" | "rss" | "regex";

export type ScrapeResult = {
  text: string;
  strategy: StrategyName;
  sourceUrl?: string;
};

export type StrategyOutput = {
  results: Partial<Record<Sign, string>>;
  sourceUrl?: string;
};

export class ScrapingError extends Error {
  constructor(sign: Sign) {
    super(`All scraping strategies failed for sign: ${sign}`);
    this.name = "ScrapingError";
  }
}

type BulkStrategy = {
  name: StrategyName;
  fn: () => Promise<StrategyOutput>;
};

const ALL_STRATEGIES: Record<StrategyName, BulkStrategy["fn"]> = {
  css: scrapeAllWithCSS,
  rss: scrapeAllWithRSS,
  regex: scrapeAllWithRegex,
};

const STRATEGIES: BulkStrategy[] = GORAFI_CONFIG.strategyOrder.map((name) => ({
  name,
  fn: ALL_STRATEGIES[name],
}));

/**
 * Scrape all 12 signs using the first strategy that returns a usable result set.
 * Falls through to the next strategy if the current one returns fewer than 6 signs.
 * Returns a map of sign → { text, strategy } for every sign that was successfully scraped.
 */
export async function scrapeAllHoroscopes(): Promise<Partial<Record<Sign, ScrapeResult>>> {
  for (const { name, fn } of STRATEGIES) {
    try {
      const { results, sourceUrl } = await fn();
      const entries = Object.entries(results) as [Sign, string][];
      if (entries.length < 6) continue; // too few signs — try next strategy

      const mapped: Partial<Record<Sign, ScrapeResult>> = {};
      for (const [sign, text] of entries) {
        if (text.trim()) mapped[sign] = { text: text.trim(), strategy: name, sourceUrl };
      }
      console.log(`[scraper] Strategy "${name}" returned ${entries.length} signs`);
      return mapped;
    } catch (err) {
      console.warn(`[scraper] Strategy "${name}" threw:`, err);
    }
  }
  console.warn("[scraper] All strategies failed");
  return {};
}

/**
 * Scrape a single sign.
 * Runs scrapeAllHoroscopes internally — callers should prefer that for bulk use
 * to avoid re-fetching the article multiple times.
 */
export async function scrapeHoroscope(sign: Sign): Promise<ScrapeResult> {
  const all = await scrapeAllHoroscopes();
  const result = all[sign];
  if (result) return result;

  // Partial result — the sign was not found even though some others were
  throw new ScrapingError(sign);
}

/**
 * Returns the list of sign slugs that are missing from the cache, so the caller
 * knows which ones need a fresh scrape.
 */
export function getMissingSigns(cached: Partial<Record<Sign, unknown>>): Sign[] {
  return SIGN_SLUGS.filter((s) => !cached[s]);
}
