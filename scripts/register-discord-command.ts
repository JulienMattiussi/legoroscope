/**
 * One-off script — registers the /horoscope slash command with Discord.
 * Run once per environment (or after changing the command definition).
 *
 *   make discord-register
 */

import { readFileSync } from "fs";

async function main() {
  loadEnvFile(".env.local");

  const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
  const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

  if (!APPLICATION_ID || !BOT_TOKEN) {
    console.error("❌  Missing env vars: DISCORD_APPLICATION_ID and/or DISCORD_BOT_TOKEN");
    console.error("    Add them to .env.local and retry.");
    process.exit(1);
  }

  const command = {
    name: "horoscope",
    description: "Affiche l'horoscope de la semaine selon Le Gorafi",
    options: [
      {
        name: "signe",
        description: "Signe du zodiaque (ex: cancer) ou pseudo (ex: michel)",
        type: 3, // STRING
        required: true,
      },
    ],
    // 0 = guild install, 1 = user install (works in any conversation)
    integration_types: [0, 1],
    // 0 = server channel, 1 = bot DM, 2 = private channel / group DM
    contexts: [0, 1, 2],
  };

  const res = await fetch(`https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  const data = (await res.json()) as { name?: string; id?: string; message?: string };

  if (!res.ok) {
    console.error("❌  Discord API error:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`✅  Command registered: /${data.name}  (id: ${data.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// ---------------------------------------------------------------------------

function loadEnvFile(path: string) {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local absent — rely on process.env already being set
  }
}
