import * as cheerio from "cheerio";
import type { Sign } from "@/lib/signs";
import { SIGNS } from "@/lib/signs";
import { GORAFI_CONFIG } from "@/lib/gorafi.config";

/**
 * Strategy 1: CSS selectors on the Gorafi horoscope article.
 *
 * Flow:
 *   1. Fetch the category page and find the latest article URL.
 *   2. Fetch the article and parse all sign paragraphs in one pass.
 *
 * Article structure (from live site):
 *   <div id="mvp-post-content">
 *     <p><strong>Bélier : </strong>prediction text…</p>
 *   </div>
 */
export async function scrapeAllWithCSS(): Promise<Partial<Record<Sign, string>>> {
  const articleUrl = await findLatestArticleUrl();
  if (!articleUrl) return {};

  const html = await fetchPage(articleUrl);
  if (!html) return {};

  return extractSignsFromArticle(html);
}

export function extractSignsFromArticle(html: string): Partial<Record<Sign, string>> {
  const $ = cheerio.load(html);
  const results: Partial<Record<Sign, string>> = {};

  $(GORAFI_CONFIG.selectors.signParagraph).each((_i, el) => {
    const strong = $(el).find("strong").first();
    if (!strong.length) return;

    const strongText = strong.text().replace(/\s*:\s*$/, "").trim();

    const sign = SIGNS.find(
      (s) => s.label.toLowerCase() === strongText.toLowerCase(),
    );
    if (!sign) return;

    // Text content of <p> minus the <strong> part
    strong.remove();
    const prediction = $(el).text().trim();
    if (prediction.length > 10) {
      results[sign.slug] = prediction;
    }
  });

  return results;
}

async function findLatestArticleUrl(): Promise<string | null> {
  const html = await fetchPage(GORAFI_CONFIG.categoryUrl);
  if (!html) return null;

  const $ = cheerio.load(html);
  let found: string | null = null;

  $("a[href]").each((_i, el) => {
    const href = $(el).attr("href") ?? "";
    if (GORAFI_CONFIG.articleUrlPattern.test(href)) {
      found = href;
      return false; // break — first match is the most recent
    }
  });

  return found;
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
