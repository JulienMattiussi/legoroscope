import { NextResponse } from "next/server";
import { SIGN_SLUGS, isValidSign } from "@/lib/signs";
import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";
import { scrapeAllHoroscopes, getMissingSigns } from "@/lib/scraper";

export async function GET() {
  // Load whatever is already cached
  const cached: Record<string, Awaited<ReturnType<typeof getCachedHoroscope>>> = {};
  await Promise.all(
    SIGN_SLUGS.map(async (sign) => {
      cached[sign] = await getCachedHoroscope(sign);
    }),
  );

  const missing = getMissingSigns(cached);

  if (missing.length > 0) {
    try {
      // At least one sign is uncached — fetch the article once for all missing signs
      const scraped = await scrapeAllHoroscopes();
      const now = new Date().toISOString();
      for (const [s, result] of Object.entries(scraped)) {
        if (isValidSign(s) && result && !cached[s]) {
          await setCachedHoroscope(s, result);
          cached[s] = { ...result, fetchedAt: now };
        }
      }
    } catch {
      // scraping failed — return whatever is in cache (stale or null)
    }
  }

  const results = SIGN_SLUGS.map((sign) => ({
    sign,
    ...(cached[sign] ?? { text: null, error: true }),
  }));

  return NextResponse.json(results);
}
