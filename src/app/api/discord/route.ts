import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature, handleInteraction } from "@/lib/discord";
import { isValidSign, getSign } from "@/lib/signs";
import { getCachedHoroscope, setCachedHoroscope } from "@/lib/cache";
import { scrapeHoroscope } from "@/lib/scraper";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(rawBody);

  // Discord PING — must respond with PONG
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  const signOption = interaction.data?.options?.find((o: { name: string }) => o.name === "signe")
    ?.value as string | undefined;

  if (!signOption || !isValidSign(signOption)) {
    return NextResponse.json({
      type: 4,
      data: { content: "Signe invalide. Utilise un signe du zodiaque valide." },
    });
  }

  const signMeta = getSign(signOption)!;

  let horoscope: string | null = null;
  const cached = await getCachedHoroscope(signOption);
  if (cached) {
    horoscope = cached.text;
  } else {
    try {
      const result = await scrapeHoroscope(signOption);
      await setCachedHoroscope(signOption, result);
      horoscope = result.text;
    } catch {
      // horoscope stays null
    }
  }

  const response = handleInteraction(interaction, horoscope, signMeta.label);
  return NextResponse.json(response);
}
