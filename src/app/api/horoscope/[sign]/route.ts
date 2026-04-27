import { NextRequest, NextResponse } from "next/server";
import { isValidSign, findSignByInput } from "@/lib/signs";
import type { Sign } from "@/lib/signs";
import { getCachedHoroscope, setCachedHoroscope, getPseudoSign } from "@/lib/cache";
import { scrapeAllHoroscopes, ScrapingError } from "@/lib/scraper";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ sign: string }> }) {
  const { sign: param } = await params;

  let sign: Sign;
  const signMatch = findSignByInput(param);
  if (signMatch) {
    sign = signMatch.slug;
  } else {
    const entry = await getPseudoSign(param);
    if (!entry) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });
    sign = entry.sign;
  }

  const cached = await getCachedHoroscope(sign);
  if (cached) return NextResponse.json({ ...cached, sign });

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

    return NextResponse.json({ ...result, fetchedAt: now, sign });
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
