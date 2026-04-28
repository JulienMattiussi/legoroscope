import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllUserAliases } from "@/lib/cache";
import { AliasManager, type AliasData } from "@/components/AliasManager";

export const dynamic = "force-dynamic";

export default async function AliasesPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");
  const userId = session.user!.id!;

  const raw = await getAllUserAliases(userId);
  const aliases: AliasData[] = Object.entries(raw)
    .map(([alias, signs]) => ({ alias, signs }))
    .sort((a, b) => a.alias.localeCompare(b.alias, "fr", { sensitivity: "base" }));

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
        Alias
      </h1>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
        Un alias associe un nom à un ou plusieurs signes. Utilisez-le dans Discord ou via l&apos;API
        pour obtenir les horoscopes de plusieurs signes à la fois.
      </p>
      <AliasManager initialAliases={aliases} />
    </main>
  );
}
