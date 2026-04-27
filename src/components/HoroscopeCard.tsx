import type { CachedHoroscope } from "@/lib/cache";
import type { Sign } from "@/lib/signs";
import { getSign } from "@/lib/signs";
import Link from "next/link";
import { CopyButton } from "./CopyButton";

type Props = {
  sign: Sign;
  data: (CachedHoroscope & { sign: Sign }) | null;
  pseudoCount?: number;
};

export function HoroscopeCard({ sign, data, pseudoCount = 0 }: Props) {
  const meta = getSign(sign)!;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Link
        href={`/${sign}`}
        style={{
          display: "block",
          padding: "1.25rem 1.25rem 0.75rem",
          textDecoration: "none",
          color: "var(--text)",
          flex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "1.5rem" }}>{meta.emoji}</span>
          <strong style={{ color: "var(--brand-dark)" }}>{meta.label}</strong>
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {data?.stale && (
              <span
                title="Données de la semaine précédente"
                style={{
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
            {pseudoCount > 0 && (
              <span
                title={`${pseudoCount} pseudo${pseudoCount > 1 ? "s" : ""}`}
                style={{
                  fontSize: "0.68rem",
                  color: "var(--text-muted)",
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "1px 6px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {pseudoCount}
              </span>
            )}
            {data?.text && <CopyButton text={data.text} />}
          </span>
        </div>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-muted)",
            margin: 0,
            display: "-webkit-box",
            WebkitLineClamp: 5,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data?.text ?? "Chargement…"}
        </p>
      </Link>

    </div>
  );
}
