import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isValidSign, SIGN_SLUGS, localeEquals } from "@/lib/signs";
import { getAllUserAliases, getUserAlias, setUserAlias, setAliasIndex } from "@/lib/cache";
import type { Sign } from "@/lib/signs";

type AliasItem = { alias: string; signs: Sign[] };

export async function GET() {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const raw = await getAllUserAliases(userId);
  const aliases: AliasItem[] = Object.entries(raw)
    .map(([alias, signs]) => ({ alias, signs }))
    .sort((a, b) => a.alias.localeCompare(b.alias, "fr", { sensitivity: "base" }));

  return NextResponse.json({ aliases });
}

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const body = (await req.json()) as Record<string, unknown>;

  // Bulk import: { entries: [{alias, signs}] } or old format: { entries: [{pseudo, sign}] }
  if ("entries" in body) {
    const entries = body.entries;
    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: "Format invalide." }, { status: 400 });
    }

    type NewEntry = { alias: string; signs: Sign[] };
    type OldEntry = { pseudo: string; sign: Sign };

    const isOld = (e: unknown): e is OldEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as OldEntry).pseudo === "string" &&
      isValidSign((e as OldEntry).sign);

    const isNew = (e: unknown): e is NewEntry =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as NewEntry).alias === "string" &&
      Array.isArray((e as NewEntry).signs) &&
      ((e as NewEntry).signs as unknown[]).every((s) => isValidSign(s as string));

    // Normalize to NewEntry[]
    let normalized: NewEntry[];
    const firstOld = entries.find(isOld);
    const firstNew = entries.find(isNew);

    if (firstOld && !firstNew) {
      // Old pseudo format - group by pseudo name, merge signs
      const map = new Map<string, Set<Sign>>();
      for (const e of entries) {
        if (!isOld(e)) continue;
        const key = e.pseudo.trim();
        if (!key || SIGN_SLUGS.some((s) => localeEquals(s, key))) continue;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(e.sign);
      }
      normalized = Array.from(map.entries()).map(([alias, signs]) => ({
        alias,
        signs: Array.from(signs),
      }));
    } else {
      normalized = entries.filter((e): e is NewEntry => {
        if (!isNew(e)) return false;
        const trimmed = (e as NewEntry).alias.trim();
        return !!trimmed && !SIGN_SLUGS.some((s) => localeEquals(s, trimmed));
      });
    }

    if (normalized.length === 0) {
      return NextResponse.json({ error: "Aucune entrée valide." }, { status: 400 });
    }

    try {
      for (const { alias, signs } of normalized) {
        const trimmed = alias.trim();
        await setUserAlias(userId, trimmed, signs);
        await setAliasIndex(trimmed, signs, userId);
      }
      const label = `${normalized.length} alias importé${normalized.length > 1 ? "s" : ""}`;
      return NextResponse.json({ imported: normalized.length, message: label });
    } catch {
      return NextResponse.json({ error: "Erreur lors de l'importation." }, { status: 500 });
    }
  }

  // Single create: { alias, signs }
  const alias = typeof body.alias === "string" ? body.alias.trim() : "";
  if (!alias) return NextResponse.json({ error: "Nom d'alias invalide." }, { status: 400 });

  if (SIGN_SLUGS.some((s) => localeEquals(s, alias))) {
    return NextResponse.json({ error: "Ce nom est réservé." }, { status: 400 });
  }

  const signs = Array.isArray(body.signs)
    ? (body.signs as unknown[]).filter((s): s is Sign => isValidSign(s as string))
    : [];

  const existing = await getUserAlias(userId, alias);
  if (existing !== null) {
    return NextResponse.json({ error: "Cet alias existe déjà." }, { status: 409 });
  }

  try {
    await setUserAlias(userId, alias, signs);
    await setAliasIndex(alias, signs, userId);
    return NextResponse.json({ alias, signs });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la création." }, { status: 500 });
  }
}
