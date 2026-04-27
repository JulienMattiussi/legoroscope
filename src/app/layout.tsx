import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Legoroscope",
  description: "L'horoscope de la semaine selon Le Gorafi.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();

  return (
    <html lang="fr">
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "0.75rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            background: "var(--surface)",
          }}
        >
          <Link
            href="/"
            style={{
              fontWeight: 800,
              color: "var(--brand-dark)",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Image
              src="/ferret.jpg"
              alt=""
              width={28}
              height={28}
              style={{ borderRadius: "6px" }}
              unoptimized
            />
            Legoroscope
          </Link>
          <nav style={{ marginLeft: "auto", display: "flex", gap: "1rem", alignItems: "center" }}>
            {session ? (
              <>
                <Link
                  href="/pseudos"
                  style={{ color: "var(--brand)", textDecoration: "none", fontSize: "0.9rem" }}
                >
                  Pseudos
                </Link>
                <Link
                  href="/api/auth/signout"
                  style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "0.9rem" }}
                >
                  Déconnexion
                </Link>
              </>
            ) : (
              <Link
                href="/api/auth/signin"
                style={{
                  background: "var(--brand)",
                  color: "var(--text-inverse)",
                  padding: "0.4rem 1rem",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                  fontSize: "0.9rem",
                }}
              >
                Connexion GitHub
              </Link>
            )}
          </nav>
        </header>
        <div style={{ flex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
