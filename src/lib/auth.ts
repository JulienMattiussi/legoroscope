import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    session({ session, token }) {
      // Expose the GitHub user ID on the session for KV lookups
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
