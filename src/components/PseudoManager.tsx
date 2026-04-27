"use client";

import { useState, useEffect } from "react";
import type { Sign } from "@/lib/signs";

type Props = {
  sign: Sign;
  initialPseudos: string[];
};

type Notif = { message: string; type: "info" | "error" };

export function PseudoManager({ sign, initialPseudos }: Props) {
  const [pseudos, setPseudos] = useState(initialPseudos);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<Notif | null>(null);

  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(null), 4000);
    return () => clearTimeout(t);
  }, [notif]);

  async function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/user/pseudos/${sign}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo: trimmed }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPseudos(data.pseudos);
      setInput("");
      if (data.movedFrom) {
        setNotif({ message: `"${trimmed}" déplacé depuis le ${data.movedFrom}.`, type: "info" });
      }
    } catch {
      setNotif({ message: "Une erreur est survenue.", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(pseudo: string) {
    try {
      const res = await fetch(`/api/user/pseudos/${sign}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pseudo }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPseudos(data.pseudos);
    } catch {
      setNotif({ message: "Une erreur est survenue.", type: "error" });
    }
  }

  return (
    <div style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--brand-dark)", marginBottom: "0.75rem" }}>
        Pseudos associés
      </h2>

      {pseudos.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {pseudos.map((pseudo) => (
            <li
              key={pseudo}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "var(--brand-tint)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.3rem 0.6rem",
                fontSize: "0.9rem",
                color: "var(--text)",
              }}
            >
              {pseudo}
              <button
                onClick={() => handleDelete(pseudo)}
                aria-label={`Supprimer ${pseudo}`}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Ajouter un pseudo…"
          style={{
            flex: 1,
            padding: "0.4rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            fontSize: "0.9rem",
            color: "var(--text)",
            background: "var(--bg)",
            outline: "none",
          }}
        />
        <button
          onClick={handleAdd}
          disabled={saving || !input.trim()}
          style={{
            padding: "0.4rem 1rem",
            background: "var(--brand)",
            color: "var(--text-inverse)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: "pointer",
            opacity: !input.trim() ? 0.5 : 1,
          }}
        >
          Ajouter
        </button>
      </div>

      {notif && (
        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.85rem",
            color: notif.type === "error" ? "red" : "var(--brand)",
          }}
        >
          {notif.message}
        </p>
      )}
    </div>
  );
}
