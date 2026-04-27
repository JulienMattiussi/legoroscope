import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidSign, SIGN_SLUGS, getSign } from "@/lib/signs";
import { getUserPseudos, setUserPseudos } from "@/lib/cache";

type Params = { params: Promise<{ sign: string }> };

const isSame = (a: string, b: string) => a.localeCompare(b, "fr", { sensitivity: "base" }) === 0;

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { sign } = await params;
  if (!isValidSign(sign)) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });

  const pseudos = await getUserPseudos(session.user.id, sign);
  return NextResponse.json({ pseudos });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { sign } = await params;
  if (!isValidSign(sign)) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });

  const { pseudo } = (await req.json()) as { pseudo: string };
  const trimmed = pseudo?.trim();
  if (!trimmed) return NextResponse.json({ error: "Pseudo invalide." }, { status: 400 });

  // Remove the pseudo (case-insensitive) from any other sign it might already belong to
  let movedFrom: string | null = null;
  await Promise.all(
    SIGN_SLUGS.filter((s) => s !== sign).map(async (otherSign) => {
      const others = await getUserPseudos(session.user.id, otherSign);
      const match = others.find((p) => isSame(p, trimmed));
      if (match) {
        await setUserPseudos(session.user.id, otherSign, others.filter((p) => !isSame(p, trimmed)));
        movedFrom = getSign(otherSign)?.label ?? otherSign;
      }
    }),
  );

  const pseudos = await getUserPseudos(session.user.id, sign);
  if (!pseudos.some((p) => isSame(p, trimmed))) {
    pseudos.push(trimmed);
    await setUserPseudos(session.user.id, sign, pseudos);
  }

  return NextResponse.json({ pseudos, movedFrom });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { sign } = await params;
  if (!isValidSign(sign)) return NextResponse.json({ error: "Signe inconnu." }, { status: 404 });

  const { pseudo } = (await req.json()) as { pseudo: string };
  const pseudos = await getUserPseudos(session.user.id, sign);
  const updated = pseudos.filter((p) => !isSame(p, pseudo));
  await setUserPseudos(session.user.id, sign, updated);

  return NextResponse.json({ pseudos: updated });
}
