import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SIGN_SLUGS } from "@/lib/signs";
import { getUserPseudos } from "@/lib/cache";
import { PseudoGrid, type PseudoEntry } from "@/components/PseudoGrid";
import type { Sign } from "@/lib/signs";

export const dynamic = "force-dynamic";

export default async function PseudosPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");
  const userId = session.user!.id!;

  const entries: PseudoEntry[] = [];
  await Promise.all(
    SIGN_SLUGS.map(async (sign) => {
      const pseudos = await getUserPseudos(userId, sign as Sign);
      for (const pseudo of pseudos) entries.push({ pseudo, sign: sign as Sign });
    }),
  );
  entries.sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }));

  return (
    <main style={{ maxWidth: "900px", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "var(--brand-dark)",
          marginBottom: "0.25rem",
        }}
      >
        Pseudos
      </h1>
      <PseudoGrid initialEntries={entries} />
    </main>
  );
}
