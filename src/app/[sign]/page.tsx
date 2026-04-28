import { notFound } from "next/navigation";
import { isValidSign, getSign } from "@/lib/signs";
import { getCachedHoroscope, getAllUserAliases } from "@/lib/cache";
import { auth } from "@/lib/auth";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sign: string }> };

export default async function SignPage({ params }: Props) {
  const { sign } = await params;

  if (!isValidSign(sign)) notFound();

  const meta = getSign(sign)!;
  const data = await getCachedHoroscope(sign);
  const session = await auth();

  const coveringAliases: string[] = [];
  if (session?.user?.id) {
    const allAliases = await getAllUserAliases(session.user.id);
    for (const [alias, signs] of Object.entries(allAliases)) {
      if (signs.includes(sign)) coveringAliases.push(alias);
    }
    coveringAliases.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }

  return (
    <main style={{ maxWidth: "700px", margin: "0 auto", padding: "2rem 1rem" }}>
      <Link href="/" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.9rem" }}>
        ← Retour
      </Link>

      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "var(--brand-dark)",
          margin: "1rem 0 0.25rem",
        }}
      >
        {meta.emoji} {meta.label}
      </h1>

      {data?.stale && (
        <p
          style={{
            background: "var(--stale-bg)",
            color: "var(--stale)",
            borderRadius: "var(--radius-sm)",
            padding: "0.5rem 0.75rem",
            fontSize: "0.85rem",
            margin: "0.75rem 0",
          }}
        >
          Données de la semaine précédente - le scraping est temporairement indisponible.
        </p>
      )}

      {data ? (
        <>
          <p
            style={{
              fontSize: "1.1rem",
              lineHeight: 1.7,
              marginTop: "1rem",
              color: "var(--text)",
            }}
          >
            {data.text}
          </p>
          <p
            style={{
              marginTop: "1.5rem",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            Récupéré via la stratégie «{data.strategy}» le{" "}
            {new Date(data.fetchedAt).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </>
      ) : (
        <p style={{ color: "var(--text-muted)", marginTop: "1rem" }}>
          Horoscope non disponible pour le moment.
        </p>
      )}

      {session && (
        <div
          style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}
        >
          <div
            style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}
          >
            <h2
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "var(--brand-dark)",
                margin: 0,
              }}
            >
              Alias
            </h2>
            <Link
              href="/aliases"
              style={{ fontSize: "0.8rem", color: "var(--brand)", textDecoration: "none" }}
            >
              Gérer →
            </Link>
          </div>

          {coveringAliases.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0.75rem 0 0",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {coveringAliases.map((alias) => (
                <li
                  key={alias}
                  style={{
                    background: "var(--brand-tint)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.9rem",
                    color: "var(--text)",
                  }}
                >
                  {alias}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
              Aucun alias ne couvre ce signe.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
