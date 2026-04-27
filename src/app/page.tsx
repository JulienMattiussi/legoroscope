import { SIGNS, SIGN_SLUGS } from "@/lib/signs";
import { HoroscopeCard } from "@/components/HoroscopeCard";
import { auth } from "@/lib/auth";
import { getUserPseudos } from "@/lib/cache";
import { GORAFI_CONFIG } from "@/lib/gorafi.config";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import type { Sign } from "@/lib/signs";
import type { CachedHoroscope } from "@/lib/cache";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          padding: "2rem 1rem",
        }}
      >
        <div
          style={{
            textAlign: "center",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "2.5rem 3rem",
            boxShadow: "var(--shadow)",
          }}
        >
          <Image
            src="/ferret.jpg"
            alt=""
            width={80}
            height={80}
            style={{
              borderRadius: "12px",
              marginBottom: "1.75rem",
              display: "block",
              margin: "0 auto 1.75rem",
            }}
            unoptimized
          />
          <Link
            href="/api/auth/signin"
            style={{
              display: "inline-block",
              background: "var(--brand)",
              color: "var(--text-inverse)",
              padding: "0.6rem 1.5rem",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Connexion GitHub
          </Link>
        </div>
      </main>
    );
  }

  const host = (await headers()).get("host");
  const baseUrl = `${process.env.NODE_ENV === "production" ? "https" : "http"}://${host}`;
  const res = await fetch(`${baseUrl}/api/horoscopes`, { cache: "no-store" });
  const payload: Array<{ sign: Sign } & (CachedHoroscope | { text: null; error: true })> = res.ok
    ? await res.json()
    : SIGNS.map((s) => ({ sign: s.slug, text: null, error: true }));

  const userId = session.user!.id!;
  const pseudoCounts: Partial<Record<Sign, number>> = {};
  await Promise.all(
    SIGN_SLUGS.map(async (sign) => {
      const pseudos = await getUserPseudos(userId, sign);
      if (pseudos.length > 0) pseudoCounts[sign] = pseudos.length;
    }),
  );

  const sourceUrl =
    payload.find(
      (item): item is typeof item & { sourceUrl: string } =>
        "sourceUrl" in item && typeof item.sourceUrl === "string",
    )?.sourceUrl ?? GORAFI_CONFIG.categoryUrl;

  const toCard = (item: (typeof payload)[number]) => ({
    sign: item.sign,
    data: "text" in item && item.text ? (item as CachedHoroscope & { sign: Sign }) : null,
    pseudoCount: pseudoCounts[item.sign] ?? 0,
  });

  const zodiac = payload.map(toCard);

  return (
    <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
      <h1
        style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "var(--brand-dark)",
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <Image
          src="/ferret.jpg"
          alt=""
          width={36}
          height={36}
          style={{ borderRadius: "8px" }}
          unoptimized
        />
        Legoroscope
      </h1>
      <p style={{ color: "var(--text-muted)", margin: "0.25rem 0 1rem" }}>
        L&apos;horoscope de la semaine{" "}
        <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link">
          selon Le Gorafi
        </a>
        .
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "0.6rem",
        }}
      >
        {zodiac.map(({ sign, data, pseudoCount }) => (
          <div key={sign} style={sign === "furet" ? { gridColumn: "2" } : undefined}>
            <HoroscopeCard
              sign={sign as Sign}
              data={data ? ({ ...data, sign } as CachedHoroscope & { sign: Sign }) : null}
              pseudoCount={pseudoCount}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
