import type { Sign } from "@/lib/signs";
import { SIGNS } from "@/lib/signs";
import { GORAFI_CONFIG } from "@/lib/gorafi.config";
import type { StrategyOutput } from "./index";
import { fetchPage } from "./fetch";

/**
 * Strategy 3: regex on raw HTML.
 *
 * Does not rely on the cheerio DOM parser — works directly on the raw HTML string.
 * Resilient to tag restructuring as long as the text pattern holds:
 *   <strong>Sign Name : </strong>prediction text
 *
 * Flow:
 *   1. Fetch the category page and extract the latest article URL via regex.
 *   2. Fetch the article and extract each sign's prediction via regex.
 */
export async function scrapeAllWithRegex(): Promise<StrategyOutput> {
  const categoryHtml = await fetchPage(GORAFI_CONFIG.categoryUrl);
  if (!categoryHtml) return { results: {} };

  const articleUrl = findArticleUrlWithRegex(categoryHtml);
  if (!articleUrl) return { results: {} };

  const articleHtml = await fetchPage(articleUrl);
  if (!articleHtml) return { results: {} };

  return { results: extractSignsWithRegex(articleHtml), sourceUrl: articleUrl };
}

export function findArticleUrlWithRegex(html: string): string | null {
  // Match href="…/YYYY/MM/DD/horoscope-du-…/"
  const pattern = new RegExp(
    `href="(https?://[^"]*${GORAFI_CONFIG.articleUrlPattern.source}[^"]*)"`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ?? null;
}

export function extractSignsWithRegex(html: string): Partial<Record<Sign, string>> {
  // Strip script/style blocks to avoid false positives
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const results: Partial<Record<Sign, string>> = {};

  for (const sign of SIGNS) {
    const label = sign.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Pattern: <strong>Label : </strong>TEXT until next <
    const pattern = new RegExp(`<strong>\\s*${label}\\s*:\\s*<\\/strong>([^<]{10,})`, "i");
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      const text = match[1]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .replace(/&#\d+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (text.length > 10) {
        results[sign.slug] = text;
      }
    }
  }

  return results;
}
