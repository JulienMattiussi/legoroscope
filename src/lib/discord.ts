import nacl from "tweetnacl";

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

export function handleInteraction(
  interaction: DiscordInteraction,
  horoscope: string | null,
  signLabel: string,
): DiscordResponse {
  if (interaction.type === PING) {
    return { type: PONG };
  }

  if (interaction.type === APPLICATION_COMMAND) {
    if (!horoscope) {
      return {
        type: CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Désolé, l'horoscope du ${signLabel} n'est pas disponible pour le moment.`,
        },
      };
    }
    return {
      type: CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content: `**${signLabel}** — ${horoscope}` },
    };
  }

  return { type: CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Commande non reconnue." } };
}
