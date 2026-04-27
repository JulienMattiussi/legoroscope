import { SIGN_SLUGS } from "@/lib/signs";
import { getCachedHoroscope, type CachedHoroscope } from "@/lib/cache";
import { HoroscopeCard } from "@/components/HoroscopeCard";
import { auth } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import type { Sign } from "@/lib/signs";

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
          <Image src="/ferret.jpg" alt="" width={80} height={80} style={{ borderRadius: "12px", marginBottom: "1.75rem", display: "block", margin: "0 auto 1.75rem" }} unoptimized />
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

  const horoscopes = await Promise.all(
    SIGN_SLUGS.map(async (sign) => {
      const data = await getCachedHoroscope(sign);
      return { sign, data };
    }),
  );

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
        Legoroscope
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        L&apos;horoscope de la semaine selon Le Gorafi.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {horoscopes.map(({ sign, data }) => (
          <HoroscopeCard
            key={sign}
            sign={sign as Sign}
            data={data ? ({ ...data, sign } as CachedHoroscope & { sign: Sign }) : null}
          />
        ))}
      </div>
    </main>
  );
}
