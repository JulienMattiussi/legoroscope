import * as cheerio from "cheerio";
import type { Sign } from "@/lib/signs";
import { SIGNS } from "@/lib/signs";
import { GORAFI_CONFIG } from "@/lib/gorafi.config";
import { extractSignsFromArticle } from "./css";
import type { StrategyOutput } from "./index";

/**
 * Strategy 2: RSS/Atom feed.
 *
 * The category RSS feed at GORAFI_CONFIG.rssFeedUrl is a standard WordPress feed.
 * The latest <item> holds the full horoscope article in its <content:encoded> or
 * <description> tag. We extract the article URL from <link> and fetch the real page
 * (or parse the inline HTML if it's complete enough).
 *
 * Falls back to fetching the article URL from the RSS item and re-using the CSS
 * extraction logic on the full page — this makes the two strategies complementary
 * rather than redundant.
 */
export async function scrapeAllWithRSS(): Promise<StrategyOutput> {
  const xml = await fetchFeed(GORAFI_CONFIG.rssFeedUrl);
  if (!xml) return { results: {} };

  const articleUrl = extractLatestArticleUrl(xml);
  if (!articleUrl) return { results: {} };

  // Try to parse inline HTML from the RSS item first
  const inlineResults = extractFromRssInlineContent(xml);
  if (Object.keys(inlineResults).length >= 6)
    return { results: inlineResults, sourceUrl: articleUrl };

  // RSS content was incomplete — fetch the full article and re-use CSS extraction
  const html = await fetchPage(articleUrl);
  if (!html) return { results: {} };

  return { results: extractSignsFromArticle(html), sourceUrl: articleUrl };
}

export function extractLatestArticleUrl(xml: string): string | null {
  const $ = cheerio.load(xml, { xmlMode: true });
  const link = $("item link").first().text().trim();
  return link || null;
}

export function extractFromRssInlineContent(xml: string): Partial<Record<Sign, string>> {
  const $ = cheerio.load(xml, { xmlMode: true });
  const item = $("item").first();
  if (!item.length) return {};

  // WordPress feeds use <content:encoded> for full HTML or <description> for excerpt
  const encoded = item.find("encoded").first().text();
  const description = item.find("description").first().text();
  const html = encoded || description;
  if (!html) return {};

  return extractSignsFromParagraphs(html);
}

function extractSignsFromParagraphs(html: string): Partial<Record<Sign, string>> {
  const $ = cheerio.load(html);
  const results: Partial<Record<Sign, string>> = {};

  $("p").each((_i, el) => {
    const strong = $(el).find("strong").first();
    if (!strong.length) return;

    const strongText = strong
      .text()
      .replace(/\s*:\s*$/, "")
      .trim();
    const sign = SIGNS.find((s) => s.label.toLowerCase() === strongText.toLowerCase());
    if (!sign) return;

    strong.remove();
    const prediction = $(el).text().trim();
    if (prediction.length > 10) {
      results[sign.slug] = prediction;
    }
  });

  return results;
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Legoroscope/1.0)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Legoroscope/1.0)" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}
