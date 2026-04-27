import { NextRequest, NextResponse } from "next/server";
import { isValidSign } from "@/lib/signs";
import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";
import { scrapeAllHoroscopes, ScrapingError } from "@/lib/scraper";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sign: string }> }) {
  const { sign } = await params;

  if (!isValidSign(sign)) {
    return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });
  }

  const cached = await getCachedHoroscope(sign);
  if (cached) return NextResponse.json(cached);

  // Cache miss — fetch all signs at once and warm the full cache
  try {
    const all = await scrapeAllHoroscopes();
    if (Object.keys(all).length === 0) throw new ScrapingError(sign);

    const now = new Date().toISOString();
    for (const [s, result] of Object.entries(all)) {
      if (isValidSign(s) && result) {
        await setCachedHoroscope(s, result);
      }
    }

    const result = all[sign];
    if (!result) throw new ScrapingError(sign);

    return NextResponse.json({ ...result, fetchedAt: now });
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
