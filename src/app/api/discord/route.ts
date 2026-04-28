import { NextRequest, NextResponse } from "next/server";
import {
  verifyDiscordSignature,
  handleInteraction,
  autocompleteSign,
  autocompleteAliases,
} from "@/lib/discord";
import type { SignResult } from "@/lib/discord";
import { findSignByInput, getSign, isValidSign } from "@/lib/signs";
import {
  getCachedHoroscope,
  setCachedHoroscope,
  getAliasIndex,
  getAllAliasNames,
} from "@/lib/cache";
import { scrapeAllHoroscopes } from "@/lib/scraper";
import type { Sign } from "@/lib/signs";

type Option = { name: string; value: string; focused?: boolean };

const SIGN_OPTION_NAMES = ["signe", "signe2", "signe3", "signe4", "signe5"] as const;

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-signature-ed25519") ?? "";
  const timestamp = req.headers.get("x-signature-timestamp") ?? "";
  const rawBody = await req.text();

  if (!verifyDiscordSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(rawBody);
  const options = (interaction.data?.options ?? []) as Option[];

  // Discord PING - must respond with PONG
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Autocomplete - signs + aliases matching what the user has typed so far
  if (interaction.type === 4) {
    const typed = options.find((o) => o.focused)?.value ?? "";
    const allAliases = await getAllAliasNames();
    const choices = [...autocompleteSign(typed), ...autocompleteAliases(typed, allAliases)].slice(
      0,
      25,
    );
    return NextResponse.json({ type: 8, data: { choices } });
  }

  // Collect all provided sign inputs
  const inputs = SIGN_OPTION_NAMES.map(
    (name) => options.find((o) => o.name === name)?.value,
  ).filter((v): v is string => !!v);

  if (inputs.length === 0) {
    return NextResponse.json({
      type: 4,
      data: { content: "Indique un signe du zodiaque ou un alias." },
    });
  }

  // Resolve each input to one or more signs, deduplicating by slug
  const seen = new Set<Sign>();
  const signMetas: (typeof import("@/lib/signs").SIGNS)[number][] = [];

  for (const input of inputs) {
    const directMatch = findSignByInput(input);
    if (directMatch) {
      if (!seen.has(directMatch.slug)) {
        seen.add(directMatch.slug);
        signMetas.push(directMatch);
      }
      continue;
    }
    // Try alias - may resolve to multiple signs
    const aliasEntry = await getAliasIndex(input);
    if (aliasEntry) {
      for (const s of aliasEntry.signs) {
        const meta = getSign(s);
        if (meta && !seen.has(s)) {
          seen.add(s);
          signMetas.push(meta);
        }
      }
    }
  }

  if (signMetas.length === 0) {
    return NextResponse.json({
      type: 4,
      data: {
        content: `${inputs.map((i) => `"${i}"`).join(", ")} : aucun signe ni alias connu.`,
      },
    });
  }

  // Try cache for each sign; scrape once if any miss
  const cachedResults = await Promise.all(signMetas.map((s) => getCachedHoroscope(s.slug)));
  const hasMiss = cachedResults.some((c) => c === null);

  let fresh: Partial<Record<Sign, { text: string }>> = {};
  if (hasMiss) {
    try {
      const all = await scrapeAllHoroscopes();
      fresh = all;
      for (const [s, result] of Object.entries(all)) {
        if (isValidSign(s) && result) await setCachedHoroscope(s, result);
      }
    } catch {
      // scraping failed - signs without a cache entry will show as non disponible
    }
  }

  const results: SignResult[] = signMetas.map((s, i) => ({
    label: s.label,
    emoji: s.emoji,
    horoscope: cachedResults[i]?.text ?? fresh[s.slug]?.text ?? null,
  }));

  return NextResponse.json(handleInteraction(interaction, results));
}
