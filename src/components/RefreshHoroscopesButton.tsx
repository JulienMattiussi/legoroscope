"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RefreshHoroscopesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/horoscopes/refresh", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        refreshed?: number;
        error?: string;
      };
      if (!res.ok) {
        setStatus({
          message: body.error ?? "Erreur lors de l'actualisation.",
          isError: true,
        });
        return;
      }
      setStatus({
        message: `${body.refreshed ?? 0} signe${(body.refreshed ?? 0) > 1 ? "s" : ""} actualisé${(body.refreshed ?? 0) > 1 ? "s" : ""}.`,
        isError: false,
      });
      router.refresh();
    } catch {
      setStatus({ message: "Erreur réseau.", isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="toolbar-btn"
        title="Forcer l'actualisation des horoscopes en cache"
      >
        {busy ? "Actualisation..." : "Actualiser"}
      </button>
      {status && (
        <span
          role="status"
          style={{
            fontSize: "0.8rem",
            color: status.isError ? "var(--error)" : "var(--text-muted)",
          }}
        >
          {status.message}
        </span>
      )}
    </span>
  );
}
