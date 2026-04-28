import { NextRequest, NextResponse } from "next/server";
import { isValidSign, findSignByInput } from "@/lib/signs";
import type { Sign } from "@/lib/signs";
import { getCachedHoroscope, setCachedHoroscope, getAliasIndex } from "@/lib/cache";
import { scrapeAllHoroscopes, ScrapingError } from "@/lib/scraper";

async function warmAndGet(sign: Sign): Promise<{ sign: Sign } & Record<string, unknown>> {
  const cached = await getCachedHoroscope(sign);
  if (cached) return { ...cached, sign };

  const all = await scrapeAllHoroscopes();
  if (Object.keys(all).length === 0) throw new ScrapingError(sign);

  const now = new Date().toISOString();
  for (const [s, result] of Object.entries(all)) {
    if (isValidSign(s) && result) await setCachedHoroscope(s, result);
  }

  const result = all[sign];
  if (!result) throw new ScrapingError(sign);
  return { ...result, fetchedAt: now, sign };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sign: string }> }) {
  const { sign: param } = await params;

  // Try direct sign match first
  const signMatch = findSignByInput(param);
  if (signMatch) {
    try {
      return NextResponse.json(await warmAndGet(signMatch.slug));
    } catch (err) {
      if (err instanceof ScrapingError) {
        return NextResponse.json(
          { error: "Horoscope temporairement indisponible." },
          { status: 503 },
        );
      }
      throw err;
    }
  }

  // Try alias — returns one horoscope per sign covered by the alias
  const aliasEntry = await getAliasIndex(param);
  if (aliasEntry && aliasEntry.signs.length > 0) {
    try {
      // Warm cache once if any sign is missing
      const cachedAll = await Promise.all(aliasEntry.signs.map((s) => getCachedHoroscope(s)));
      const hasMiss = cachedAll.some((c) => c === null);
      if (hasMiss) {
        const all = await scrapeAllHoroscopes();
        for (const [s, result] of Object.entries(all)) {
          if (isValidSign(s) && result) await setCachedHoroscope(s, result);
        }
      }
      const results = await Promise.all(
        aliasEntry.signs.map(async (s) => {
          const h = await getCachedHoroscope(s);
          return h ? { ...h, sign: s } : { sign: s, text: null };
        }),
      );
      return NextResponse.json(results);
    } catch (err) {
      if (err instanceof ScrapingError) {
        return NextResponse.json(
          { error: "Horoscope temporairement indisponible." },
          { status: 503 },
        );
      }
      throw err;
    }
  }

  return NextResponse.json({ error: "Signe ou alias inconnu." }, { status: 404 });
}
