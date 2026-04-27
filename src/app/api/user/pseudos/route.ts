import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SIGN_SLUGS } from "@/lib/signs";
import { getUserPseudos } from "@/lib/cache";
import type { Sign } from "@/lib/signs";

export type PseudoEntry = { pseudo: string; sign: Sign };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const entries: PseudoEntry[] = [];
  await Promise.all(
    SIGN_SLUGS.map(async (sign) => {
      const pseudos = await getUserPseudos(session.user.id, sign);
      for (const pseudo of pseudos) entries.push({ pseudo, sign });
    }),
  );

  entries.sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }));

  return NextResponse.json({ pseudos: entries });
}
