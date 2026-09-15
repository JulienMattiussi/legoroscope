import { NextRequest, NextResponse } from "next/server";
import { pingCache } from "@/lib/cache";

// Invoked by Vercel Cron (see `crons` in vercel.json) to keep the Redis Cloud
// free-tier database from being deleted after 14 days without any command.
// Vercel sends `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is set
// on the project; without the secret the route stays closed.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  try {
    const pingedAt = await pingCache();
    if (!pingedAt) {
      return NextResponse.json({ error: "Redis n'a pas répondu." }, { status: 503 });
    }
    return NextResponse.json({ ok: true, pingedAt });
  } catch {
    return NextResponse.json({ error: "Erreur lors du ping Redis." }, { status: 500 });
  }
}
