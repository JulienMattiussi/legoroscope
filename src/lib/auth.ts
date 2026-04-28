import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { NextResponse } from "next/server";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    signIn({ profile }) {
      const allowed = process.env.ALLOWED_GITHUB_LOGIN;
      if (!allowed) return true;
      return profile?.login === allowed;
    },
    jwt({ token, profile }) {
      // Pin token.sub to the stable GitHub numeric ID on every sign-in.
      // Without this, NextAuth v5 may generate a different sub per session.
      if (profile?.id !== undefined) {
        token.sub = String(profile.id);
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export async function requireUserId(): Promise<string | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  return session.user.id;
}
