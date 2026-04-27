import { SIGN_SLUGS } from "@/lib/signs";
import { getCachedHoroscope, type CachedHoroscope } from "@/lib/cache";
import { HoroscopeCard } from "@/components/HoroscopeCard";
import type { Sign } from "@/lib/signs";

export const dynamic = "force-dynamic";

export default async function HomePage() {
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
