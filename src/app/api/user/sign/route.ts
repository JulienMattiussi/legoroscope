import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isValidSign } from "@/lib/signs";
import { getUserSign, setUserSign } from "@/lib/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const sign = await getUserSign(session.user.id);
  return NextResponse.json({ sign });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const body = await req.json();
  const { sign } = body as { sign: string };

  if (!isValidSign(sign)) {
    return NextResponse.json({ error: "Signe inconnu." }, { status: 400 });
  }

  await setUserSign(session.user.id, sign);
  return NextResponse.json({ sign });
}
