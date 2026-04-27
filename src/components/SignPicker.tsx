"use client";

import { SIGNS, type Sign } from "@/lib/signs";

type Props = {
  value: Sign | null;
  onChange: (sign: Sign) => void;
};

export function SignPicker({ value, onChange }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: "0.5rem",
      }}
    >
      {SIGNS.map((s) => (
        <button
          key={s.slug}
          onClick={() => onChange(s.slug)}
          aria-pressed={value === s.slug}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.75rem 0.5rem",
            borderRadius: "var(--radius-sm)",
            border: value === s.slug ? "2px solid var(--brand)" : "2px solid var(--border)",
            background: value === s.slug ? "var(--brand-tint)" : "var(--surface)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "0.8rem",
            fontWeight: value === s.slug ? 700 : 400,
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>{s.emoji}</span>
          {s.label}
        </button>
      ))}
    </div>
  );
}
