import type { CachedHoroscope } from "@/lib/cache";
import type { Sign } from "@/lib/signs";
import { getSign } from "@/lib/signs";
import Link from "next/link";

type Props = {
  sign: Sign;
  data: (CachedHoroscope & { sign: Sign }) | null;
};

export function HoroscopeCard({ sign, data }: Props) {
  const meta = getSign(sign)!;

  return (
    <Link
      href={`/${sign}`}
      style={{
        display: "block",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: "1.25rem",
        boxShadow: "var(--shadow)",
        textDecoration: "none",
        color: "var(--text)",
        transition: "box-shadow 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "1.5rem" }}>{meta.emoji}</span>
        <strong style={{ color: "var(--brand-dark)" }}>{meta.label}</strong>
        {data?.stale && (
          <span
            title="Données de la semaine précédente"
            style={{
              marginLeft: "auto",
              fontSize: "0.7rem",
              background: "var(--stale-bg)",
              color: "var(--stale)",
              borderRadius: "4px",
              padding: "1px 6px",
            }}
          >
            ancien
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--text-muted)",
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {data?.text ?? "Chargement…"}
      </p>
    </Link>
  );
}
