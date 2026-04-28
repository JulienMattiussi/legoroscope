import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { isValidSign, SIGN_SLUGS, getSign, localeEquals } from "@/lib/signs";
import { getUserPseudos, setUserPseudos, setPseudoSign, deletePseudoSign } from "@/lib/cache";

type Params = { params: Promise<{ sign: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { sign } = await params;
  if (!isValidSign(sign)) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });

  const pseudos = await getUserPseudos(userId, sign);
  return NextResponse.json({ pseudos });
}

export async function POST(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { sign } = await params;
  if (!isValidSign(sign)) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });

  const { pseudo } = (await req.json()) as { pseudo: string };
  const trimmed = pseudo?.trim();
  if (!trimmed) return NextResponse.json({ error: "Pseudo invalide." }, { status: 400 });

  if (SIGN_SLUGS.some((s) => localeEquals(s, trimmed))) {
    return NextResponse.json({ error: "Ce nom est réservé." }, { status: 400 });
  }

  try {
    let movedFrom: string | null = null;
    await Promise.all(
      SIGN_SLUGS.filter((s) => s !== sign).map(async (otherSign) => {
        const others = await getUserPseudos(userId, otherSign);
        const match = others.find((p) => localeEquals(p, trimmed));
        if (match) {
          await setUserPseudos(
            userId,
            otherSign,
            others.filter((p) => !localeEquals(p, trimmed)),
          );
          movedFrom = getSign(otherSign)?.label ?? otherSign;
        }
      }),
    );

    const pseudos = await getUserPseudos(userId, sign);
    if (!pseudos.some((p) => localeEquals(p, trimmed))) {
      pseudos.push(trimmed);
      await setUserPseudos(userId, sign, pseudos);
    }
    await setPseudoSign(trimmed, sign, userId);

    return NextResponse.json({ pseudos, movedFrom });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la sauvegarde." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const userId = await requireUserId();
  if (userId instanceof NextResponse) return userId;

  const { sign } = await params;
  if (!isValidSign(sign)) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });

  const { pseudo } = (await req.json()) as { pseudo: string };
  try {
    const pseudos = await getUserPseudos(userId, sign);
    const updated = pseudos.filter((p) => !localeEquals(p, pseudo));
    await setUserPseudos(userId, sign, updated);
    await deletePseudoSign(pseudo);
    return NextResponse.json({ pseudos: updated });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la suppression." }, { status: 500 });
  }
}
