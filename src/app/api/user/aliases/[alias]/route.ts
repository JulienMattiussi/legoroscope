import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isValidSign } from "@/lib/signs";
import {
  getUserAlias,
  setUserAlias,
  deleteUserAlias,
  setAliasIndex,
  deleteAliasIndex,
} from "@/lib/cache";
import type { Sign } from "@/lib/signs";

type Params = { params: Promise<{ alias: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { alias } = await params;
  const existing = await getUserAlias(userId, alias);
  if (existing === null) {
    return NextResponse.json({ error: "Alias introuvable." }, { status: 404 });
  }

  const { signs } = (await req.json()) as { signs: unknown[] };
  if (!Array.isArray(signs)) {
    return NextResponse.json({ error: "Format invalide." }, { status: 400 });
  }

  const validSigns = signs.filter((s): s is Sign => isValidSign(s as string));

  try {
    await setUserAlias(userId, alias, validSigns);
    await setAliasIndex(alias, validSigns, userId);
    return NextResponse.json({ alias, signs: validSigns });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { alias } = await params;
  const existing = await getUserAlias(userId, alias);
  if (existing === null) {
    return NextResponse.json({ error: "Alias introuvable." }, { status: 404 });
  }

  try {
    await deleteUserAlias(userId, alias);
    await deleteAliasIndex(alias);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la suppression." }, { status: 500 });
  }
}
