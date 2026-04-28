"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { getSign, isValidSign } from "@/lib/signs";
import type { Sign } from "@/lib/signs";

export type PseudoEntry = { pseudo: string; sign: Sign };

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pseudos.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setStatus({ message: "Fichier JSON invalide.", isError: true });
      return;
    }

    if (!Array.isArray(parsed)) {
      setStatus({ message: "Format invalide : tableau attendu.", isError: true });
      return;
    }

    const valid = parsed.filter(
      (item): item is PseudoEntry =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as PseudoEntry).pseudo === "string" &&
        isValidSign((item as PseudoEntry).sign),
    );

    if (valid.length === 0) {
      setStatus({ message: "Aucune entrée valide dans le fichier.", isError: true });
      return;
    }

    setStatus({
      message: `Importation de ${valid.length} pseudo${valid.length > 1 ? "s" : ""}…`,
      isError: false,
    });

    const bulkRes = await fetch("/api/user/pseudos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: valid }),
    });

    if (!bulkRes.ok) {
      const body = (await bulkRes.json().catch(() => null)) as { error?: string } | null;
      setStatus({ message: body?.error ?? "Erreur lors de l'importation.", isError: true });
      return;
    }

    const { message } = (await bulkRes.json()) as { imported: number; message: string };
    setStatus({ message, isError: false });

    // Reload full list from API to reflect moved pseudos
    const res = await fetch("/api/user/pseudos");
    if (res.ok) {
      const data = (await res.json()) as { pseudos: PseudoEntry[] };
      setEntries(data.pseudos);
    }
  }

  async function handleDelete(pseudo: string, sign: Sign) {
    const key = `${sign}:${pseudo}`;
    if (confirming !== key) {
      setConfirming(key);
      return;
    }
    const res = await fetch(`/api/user/pseudos/${sign}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pseudo }),
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.pseudo !== pseudo || e.sign !== sign));
      setConfirming(null);
    } else {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ message: body?.error ?? "Erreur lors de la suppression.", isError: true });
      setConfirming(null);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "1rem",
          flexWrap: "wrap",
        }}
      >
        <p style={{ color: "var(--text-muted)", margin: 0 }}>
          {entries.length} pseudo{entries.length !== 1 ? "s" : ""} enregistré
          {entries.length !== 1 ? "s" : ""}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
          <button onClick={handleExport} className="toolbar-btn">
            Exporter
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn">
            Importer
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleImport}
          />
        </div>
      </div>
      {status && (
        <p
          style={{
            fontSize: "0.85rem",
            color: status.isError ? "var(--error)" : "var(--text-muted)",
            marginBottom: "0.75rem",
          }}
        >
          {status.message}
        </p>
      )}
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
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "var(--text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
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
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "red",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      padding: "2px",
                    }}
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => setConfirming(null)}
                    aria-label="Annuler"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: "0.8rem",
                      padding: "2px",
                    }}
                  >
                    ✗
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDelete(pseudo, sign)}
                  aria-label={`Supprimer ${pseudo}`}
                  style={{
                    flexShrink: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                  }}
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
