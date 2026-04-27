"use client";

import { useEffect, useState } from "react";
import { SignPicker } from "@/components/SignPicker";
import type { Sign } from "@/lib/signs";

export default function ProfilePage() {
  const [sign, setSign] = useState<Sign | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    fetch("/api/user/sign")
      .then((r) => r.json())
      .then((data) => {
        if (data.sign) setSign(data.sign as Sign);
      })
      .catch(() => {});
  }, []);

  async function handleChange(newSign: Sign) {
    setSign(newSign);
    setStatus("saving");
    try {
      const res = await fetch("/api/user/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign: newSign }),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main style={{ maxWidth: "700px", margin: "0 auto", padding: "2rem 1rem" }}>
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: 800,
          color: "var(--brand-dark)",
          marginBottom: "0.5rem",
        }}
      >
        Mon signe
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Sélectionne ton signe du zodiaque pour le voir en priorité sur la page d&apos;accueil.
      </p>

      <SignPicker value={sign} onChange={handleChange} />

      {status === "saving" && (
        <p style={{ marginTop: "1rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Sauvegarde…
        </p>
      )}
      {status === "saved" && (
        <p style={{ marginTop: "1rem", color: "green", fontSize: "0.9rem" }}>Signe sauvegardé.</p>
      )}
      {status === "error" && (
        <p style={{ marginTop: "1rem", color: "red", fontSize: "0.9rem" }}>
          Erreur lors de la sauvegarde.
        </p>
      )}
    </main>
  );
}
