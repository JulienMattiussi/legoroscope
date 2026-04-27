import { NextRequest, NextResponse } from "next/server";
import { verifyDiscordSignature, handleInteraction } from "@/lib/discord";
import { findSignByInput, getSign } from "@/lib/signs";
import { getCachedHoroscope, setCachedHoroscope, getPseudoSign } from "@/lib/cache";
import { scrapeHoroscope } from "@/lib/scraper";
import type { Sign } from "@/lib/signs";

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

  if (!signOption) {
    return NextResponse.json({
      type: 4,
      data: { content: "Indique un signe du zodiaque ou un pseudo." },
    });
  }

  let sign: Sign;
  const signMatch = findSignByInput(signOption);
  if (signMatch) {
    sign = signMatch.slug;
  } else {
    const pseudoEntry = await getPseudoSign(signOption);
    if (!pseudoEntry) {
      return NextResponse.json({
        type: 4,
        data: {
          content: `"${signOption}" n'est ni un signe du zodiaque ni un pseudo connu.`,
        },
      });
    }
    sign = pseudoEntry.sign;
  }

  const signMeta = getSign(sign)!;

  let horoscope: string | null = null;
  const cached = await getCachedHoroscope(sign);
  if (cached) {
    horoscope = cached.text;
  } else {
    try {
      const result = await scrapeHoroscope(sign);
      await setCachedHoroscope(sign, result);
      horoscope = result.text;
    } catch {
      // horoscope stays null
    }
  }

  const response = handleInteraction(interaction, horoscope, signMeta.label);
  return NextResponse.json(response);
}
