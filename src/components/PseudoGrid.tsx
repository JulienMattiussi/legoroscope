"use client";

import { useState } from "react";
import Link from "next/link";
import { getSign } from "@/lib/signs";
import type { Sign } from "@/lib/signs";

export type PseudoEntry = { pseudo: string; sign: Sign };

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

export function PseudoGrid({ initialEntries }: { initialEntries: PseudoEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [confirming, setConfirming] = useState<string | null>(null); // "sign:pseudo"

  async function handleDelete(pseudo: string, sign: Sign) {
    const key = `${sign}:${pseudo}`;
    if (confirming !== key) { setConfirming(key); return; }
    const res = await fetch(`/api/user/pseudos/${sign}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo }),
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.pseudo !== pseudo || e.sign !== sign));
      setConfirming(null);
    }
  }

  return (
    <>
      <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
        {entries.length} pseudo{entries.length !== 1 ? "s" : ""} enregistré{entries.length !== 1 ? "s" : ""}
      </p>
      {entries.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Aucun pseudo enregistré.</p>
      )}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: "0.5rem",
        marginTop: "1rem",
      }}
    >
      {entries.map(({ pseudo, sign }) => {
        const meta = getSign(sign)!;
        return (
          <div
            key={`${sign}:${pseudo}`}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "0.5rem 0.625rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {pseudo}
              </div>
              <Link
                href={`/${sign}`}
                style={{ fontSize: "0.72rem", color: "var(--brand)", textDecoration: "none" }}
              >
                {meta.emoji} {meta.label}
              </Link>
            </div>
            {confirming === `${sign}:${pseudo}` ? (
              <div style={{ flexShrink: 0, display: "flex", gap: "2px" }}>
                <button
                  onClick={() => handleDelete(pseudo, sign)}
                  aria-label="Confirmer la suppression"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "red", fontSize: "0.8rem", fontWeight: 700, padding: "2px" }}
                >✓</button>
                <button
                  onClick={() => setConfirming(null)}
                  aria-label="Annuler"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.8rem", padding: "2px" }}
                >✗</button>
              </div>
            ) : (
              <button
                onClick={() => handleDelete(pseudo, sign)}
                aria-label={`Supprimer ${pseudo}`}
                style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px", display: "flex", alignItems: "center" }}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        );
      })}
    </div>
    </>
  );
}
