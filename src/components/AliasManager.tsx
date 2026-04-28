"use client";

import { useRef, useState } from "react";
import { SIGNS, getSign, isValidSign, SIGN_SLUGS, localeEquals } from "@/lib/signs";
import type { Sign } from "@/lib/signs";

export type AliasData = { alias: string; signs: Sign[] };

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

function sortAliases(list: AliasData[]): AliasData[] {
  return [...list].sort((a, b) => a.alias.localeCompare(b.alias, "fr", { sensitivity: "base" }));
}

export function AliasManager({ initialAliases }: { initialAliases: AliasData[] }) {
  const [aliases, setAliases] = useState<AliasData[]>(sortAliases(initialAliases));
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showStatus(message: string, isError = false) {
    setStatus({ message, isError });
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed || creating) return;
    if (SIGN_SLUGS.some((s) => localeEquals(s, trimmed))) {
      showStatus("Ce nom est réservé.", true);
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/user/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias: trimmed, signs: [] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        showStatus(body?.error ?? "Erreur lors de la création.", true);
        return;
      }
      setAliases((prev) => sortAliases([...prev, { alias: trimmed, signs: [] }]));
      setNewName("");
    } catch {
      showStatus("Erreur lors de la création.", true);
    } finally {
      setCreating(false);
    }
  }

  async function updateSigns(aliasName: string, newSigns: Sign[]) {
    const res = await fetch(`/api/user/aliases/${encodeURIComponent(aliasName)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signs: newSigns }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      showStatus(body?.error ?? "Erreur lors de la mise à jour.", true);
      return false;
    }
    setAliases((prev) => prev.map((a) => (a.alias === aliasName ? { ...a, signs: newSigns } : a)));
    return true;
  }

  async function handleAddSign(aliasName: string, sign: Sign) {
    setAddingTo(null);
    const current = aliases.find((a) => a.alias === aliasName);
    if (!current) return;
    await updateSigns(aliasName, [...current.signs, sign]);
  }

  async function handleRemoveSign(aliasName: string, sign: Sign) {
    const current = aliases.find((a) => a.alias === aliasName);
    if (!current) return;
    await updateSigns(
      aliasName,
      current.signs.filter((s) => s !== sign),
    );
  }

  async function handleDelete(aliasName: string) {
    if (confirming !== aliasName) {
      setConfirming(aliasName);
      return;
    }
    setConfirming(null);
    try {
      const res = await fetch(`/api/user/aliases/${encodeURIComponent(aliasName)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        showStatus(body?.error ?? "Erreur lors de la suppression.", true);
        return;
      }
      setAliases((prev) => prev.filter((a) => a.alias !== aliasName));
    } catch {
      showStatus("Erreur lors de la suppression.", true);
    }
  }

  function handleExport() {
    const data = aliases.map(({ alias, signs }) => ({ alias, signs }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aliases.json";
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
      showStatus("Fichier JSON invalide.", true);
      return;
    }

    if (!Array.isArray(parsed)) {
      showStatus("Format invalide : tableau attendu.", true);
      return;
    }

    type NewItem = { alias: string; signs: Sign[] };
    type OldItem = { pseudo: string; sign: Sign };

    const isOldItem = (item: unknown): item is OldItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as OldItem).pseudo === "string" &&
      isValidSign((item as OldItem).sign);

    const isNewItem = (item: unknown): item is NewItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as NewItem).alias === "string" &&
      Array.isArray((item as NewItem).signs) &&
      ((item as NewItem).signs as unknown[]).every((s) => isValidSign(s as string));

    let normalized: NewItem[];
    const firstOld = parsed.find(isOldItem);
    const firstNew = parsed.find(isNewItem);

    if (firstOld && !firstNew) {
      // Old pseudo format: group by pseudo name, merge signs
      const map = new Map<string, Set<Sign>>();
      for (const item of parsed) {
        if (!isOldItem(item)) continue;
        const key = item.pseudo.trim();
        if (!key || SIGN_SLUGS.some((s) => localeEquals(s, key))) continue;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(item.sign);
      }
      normalized = Array.from(map.entries()).map(([alias, signs]) => ({
        alias,
        signs: Array.from(signs),
      }));
    } else {
      normalized = parsed.filter((item): item is NewItem => {
        if (!isNewItem(item)) return false;
        const trimmed = item.alias.trim();
        return !!trimmed && !SIGN_SLUGS.some((s) => localeEquals(s, trimmed));
      });
    }

    if (normalized.length === 0) {
      showStatus("Aucune entrée valide dans le fichier.", true);
      return;
    }

    showStatus(`Importation de ${normalized.length} alias…`, false);

    const res = await fetch("/api/user/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: normalized }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      showStatus(body?.error ?? "Erreur lors de l'importation.", true);
      return;
    }

    const { message } = (await res.json()) as { imported: number; message: string };
    showStatus(message, false);

    const reloadRes = await fetch("/api/user/aliases");
    if (reloadRes.ok) {
      const data = (await reloadRes.json()) as { aliases: AliasData[] };
      setAliases(data.aliases);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nouvel alias…"
          style={{
            padding: "0.4rem 0.75rem",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            fontSize: "0.9rem",
            color: "var(--text)",
            background: "var(--bg)",
            outline: "none",
            minWidth: "180px",
          }}
        />
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="toolbar-btn"
          style={{ opacity: !newName.trim() ? 0.5 : 1 }}
        >
          Créer
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
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

      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
        {aliases.length} alias enregistré{aliases.length !== 1 ? "s" : ""}
      </p>

      {aliases.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          Aucun alias. Créez-en un pour associer un nom à un ou plusieurs signes.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {aliases.map(({ alias, signs }) => {
          const available = SIGNS.filter((s) => !signs.includes(s.slug));
          return (
            <div
              key={alias}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "0.5rem 0.75rem",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontWeight: 600,
                  minWidth: "8rem",
                  color: "var(--text)",
                  fontSize: "0.9rem",
                }}
              >
                {alias}
              </span>

              {signs.map((s) => {
                const meta = getSign(s)!;
                return (
                  <span
                    key={s}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      background: "var(--brand-tint)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.2rem 0.5rem",
                      fontSize: "0.82rem",
                      color: "var(--text)",
                    }}
                  >
                    {meta.emoji} {meta.label}
                    <button
                      onClick={() => handleRemoveSign(alias, s)}
                      aria-label={`Retirer ${meta.label} de ${alias}`}
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
                  </span>
                );
              })}

              {addingTo === alias ? (
                <>
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) handleAddSign(alias, e.target.value as Sign);
                    }}
                    style={{
                      fontSize: "0.85rem",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      padding: "0.2rem 0.4rem",
                      background: "var(--bg)",
                      color: "var(--text)",
                    }}
                  >
                    <option value="" disabled>
                      Choisir un signe…
                    </option>
                    {available.map((s) => (
                      <option key={s.slug} value={s.slug}>
                        {s.emoji} {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setAddingTo(null)}
                    aria-label="Annuler l'ajout de signe"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-muted)",
                      fontSize: "0.9rem",
                      padding: "2px",
                    }}
                  >
                    ✗
                  </button>
                </>
              ) : available.length > 0 ? (
                <button
                  onClick={() => setAddingTo(alias)}
                  aria-label={`Ajouter un signe à ${alias}`}
                  className="add-sign-btn"
                >
                  + Signe
                </button>
              ) : null}

              <div style={{ marginLeft: "auto", display: "flex", gap: "2px" }}>
                {confirming === alias ? (
                  <>
                    <button
                      onClick={() => handleDelete(alias)}
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
                  </>
                ) : (
                  <button
                    onClick={() => handleDelete(alias)}
                    aria-label={`Supprimer l'alias ${alias}`}
                    style={{
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
            </div>
          );
        })}
      </div>
    </>
  );
}
