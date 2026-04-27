import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isValidSign, SIGN_SLUGS } from "@/lib/signs";
import { getUserPseudos, setUserPseudos, setPseudoSign, deletePseudoSign } from "@/lib/cache";
import type { Sign } from "@/lib/signs";

export type PseudoEntry = { pseudo: string; sign: Sign };

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const entries: PseudoEntry[] = [];
  await Promise.all(
    SIGN_SLUGS.map(async (sign) => {
      const pseudos = await getUserPseudos(userId, sign);
      for (const pseudo of pseudos) entries.push({ pseudo, sign });
    }),
  );

  entries.sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }));

  return NextResponse.json({ pseudos: entries });
}

const isSame = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { entries } = (await req.json()) as { entries: unknown[] };
  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  }

  const valid = entries.filter(
    (e): e is { pseudo: string; sign: Sign } =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as { pseudo?: unknown }).pseudo === "string" &&
      isValidSign((e as { sign?: unknown }).sign as string) &&
      !SIGN_SLUGS.some((s) => isSame(s, ((e as { pseudo: string }).pseudo ?? "").trim())),
  );

  let imported = 0;
  for (const { pseudo, sign } of valid) {
    const trimmed = pseudo.trim();
    if (!trimmed) continue;

    // Remove from any other sign (case-insensitive)
    await Promise.all(
      SIGN_SLUGS.filter((s) => s !== sign).map(async (otherSign) => {
        const others = await getUserPseudos(userId, otherSign);
        if (others.some((p) => isSame(p, trimmed))) {
          await setUserPseudos(
            userId,
            otherSign,
            others.filter((p) => !isSame(p, trimmed)),
          );
          await deletePseudoSign(trimmed);
        }
      }),
    );

    const pseudos = await getUserPseudos(userId, sign);
    if (!pseudos.some((p) => isSame(p, trimmed))) {
      pseudos.push(trimmed);
      await setUserPseudos(userId, sign, pseudos);
    }
    await setPseudoSign(trimmed, sign, userId);
    imported++;
  }

  const label = `${imported} pseudo${imported > 1 ? "s" : ""} importé${imported > 1 ? "s" : ""}`;
  return NextResponse.json({ imported, message: label });
}
