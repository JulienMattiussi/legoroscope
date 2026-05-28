import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isValidSign } from "@/lib/signs";
import { setCachedHoroscope } from "@/lib/cache";
import { scrapeAllHoroscopes } from "@/lib/scraper";

export async function POST() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  try {
    const scraped = await scrapeAllHoroscopes();
    const entries = Object.entries(scraped).filter(([s, result]) => isValidSign(s) && !!result) as [
      string,
      NonNullable<(typeof scraped)[keyof typeof scraped]>,
    ][];

    if (entries.length === 0) {
      return NextResponse.json({ error: "Scraping a échoué, cache inchangé." }, { status: 503 });
    }

    for (const [s, result] of entries) {
      if (isValidSign(s)) await setCachedHoroscope(s, result);
    }

    return NextResponse.json({ refreshed: entries.length });
  } catch {
    return NextResponse.json({ error: "Erreur lors de l'actualisation." }, { status: 500 });
  }
}
