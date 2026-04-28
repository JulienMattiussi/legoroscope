import nacl from "tweetnacl";
import { SIGNS, normalize } from "@/lib/signs";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY ?? "";

export type DiscordInteraction = {
  type: number;
  data?: {
    name: string;
    options?: Array<{ name: string; value: string }>;
  };
};

export type DiscordResponse = {
  type: number;
  data?: { content: string };
};

export type SignResult = {
  label: string;
  emoji: string;
  horoscope: string | null;
};

// Interaction types
const PING = 1;
const APPLICATION_COMMAND = 2;

// Response types
const PONG = 1;
const CHANNEL_MESSAGE_WITH_SOURCE = 4;

export function verifyDiscordSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
): boolean {
  if (!PUBLIC_KEY) return false;
  try {
    const message = Buffer.from(timestamp + rawBody);
    const sig = Buffer.from(signature, "hex");
    const key = Buffer.from(PUBLIC_KEY, "hex");
    return nacl.sign.detached.verify(
      new Uint8Array(message),
      new Uint8Array(sig),
      new Uint8Array(key),
    );
  } catch {
    return false;
  }
}

export function autocompleteSign(typed: string): { name: string; value: string }[] {
  const n = normalize(typed);
  return SIGNS.filter((s) => s.slug.startsWith(n) || normalize(s.label).startsWith(n)).map((s) => ({
    name: `${s.emoji} ${s.label}`,
    value: s.slug,
  }));
}

export function autocompleteAliases(
  typed: string,
  allAliases: string[],
): { name: string; value: string }[] {
  const n = normalize(typed);
  if (!n) return [];
  return allAliases.filter((a) => normalize(a).startsWith(n)).map((a) => ({ name: a, value: a }));
}

export function handleInteraction(
  interaction: DiscordInteraction,
  results: SignResult[],
): DiscordResponse {
  if (interaction.type === PING) return { type: PONG };

  if (interaction.type === APPLICATION_COMMAND) {
    const lines = results.map(({ emoji, label, horoscope }) =>
      horoscope
        ? `${emoji} **${label}** - ${horoscope}`
        : `${emoji} **${label}** - *non disponible*`,
    );
    return { type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: lines.join("\n") } };
  }

  return { type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Commande non reconnue." } };
}
