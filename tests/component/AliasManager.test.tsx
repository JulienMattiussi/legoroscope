import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AliasManager } from "@/components/AliasManager";
import type { AliasData } from "@/components/AliasManager";

// jsdom does not implement these URL methods
Object.assign(URL, {
  createObjectURL: vi.fn(() => "blob:fake"),
  revokeObjectURL: vi.fn(),
});

const ALIASES: AliasData[] = [
  { alias: "michel", signs: ["lion", "cancer"] },
  { alias: "caroline", signs: ["belier"] },
];

function makeFileWithText(content: unknown) {
  return { text: () => Promise.resolve(JSON.stringify(content)) } as File;
}

function makeBadFile() {
  return { text: () => Promise.resolve("not json") } as File;
}

function triggerFileInput(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ aliases: ALIASES }),
    }),
  );
});

describe("AliasManager — display", () => {
  it("renders alias names", () => {
    render(<AliasManager initialAliases={ALIASES} />);
    expect(screen.getByText("michel")).toBeTruthy();
    expect(screen.getByText("caroline")).toBeTruthy();
  });

  it("renders sign chips for each alias", () => {
    render(<AliasManager initialAliases={ALIASES} />);
    expect(screen.getByText(/Lion/)).toBeTruthy();
    expect(screen.getByText(/Cancer/)).toBeTruthy();
    expect(screen.getByText(/Bélier/)).toBeTruthy();
  });

  it("shows alias count", () => {
    render(<AliasManager initialAliases={ALIASES} />);
    expect(screen.getByText(/2 alias/)).toBeTruthy();
  });

  it("shows empty state when no aliases", () => {
    render(<AliasManager initialAliases={[]} />);
    expect(screen.getByText(/Aucun alias/)).toBeTruthy();
  });
});

describe("AliasManager — create", () => {
  it("creates a new alias and adds it to the list", async () => {
    vi.mocked(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ alias: "sarah", signs: [] }),
    } as Response);

    render(<AliasManager initialAliases={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Nouvel alias…"), {
      target: { value: "sarah" },
    });
    fireEvent.click(screen.getByText("Créer"));

    await waitFor(() => expect(screen.getByText("sarah")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith(
      "/api/user/aliases",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows error when alias name is a reserved sign slug", async () => {
    render(<AliasManager initialAliases={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Nouvel alias…"), {
      target: { value: "lion" },
    });
    fireEvent.click(screen.getByText("Créer"));

    await waitFor(() => expect(screen.getByText("Ce nom est réservé.")).toBeTruthy());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows error when API returns failure", async () => {
    vi.mocked(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Cet alias existe déjà." }),
    } as Response);

    render(<AliasManager initialAliases={[]} />);
    fireEvent.change(screen.getByPlaceholderText("Nouvel alias…"), {
      target: { value: "doublon" },
    });
    fireEvent.click(screen.getByText("Créer"));

    await waitFor(() => expect(screen.getByText("Cet alias existe déjà.")).toBeTruthy());
  });
});

describe("AliasManager — remove sign", () => {
  it("removes a sign from an alias via the × button", async () => {
    vi.mocked(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ alias: "michel", signs: ["cancer"] }),
    } as Response);

    render(<AliasManager initialAliases={ALIASES} />);
    fireEvent.click(screen.getByLabelText("Retirer Lion de michel"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/user/aliases/michel",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    const body = JSON.parse(
      (vi.mocked(fetch as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit)
        .body as string,
    ) as { signs: string[] };
    expect(body.signs).not.toContain("lion");
  });
});

describe("AliasManager — delete", () => {
  it("requires confirmation before deleting", async () => {
    render(<AliasManager initialAliases={ALIASES} />);
    fireEvent.click(screen.getByLabelText("Supprimer l'alias michel"));
    expect(screen.getByLabelText("Confirmer la suppression")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes on confirmation and removes from list", async () => {
    vi.mocked(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response);

    render(<AliasManager initialAliases={ALIASES} />);
    fireEvent.click(screen.getByLabelText("Supprimer l'alias michel"));
    fireEvent.click(screen.getByLabelText("Confirmer la suppression"));

    await waitFor(() => expect(screen.queryByText("michel")).toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      "/api/user/aliases/michel",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows error when delete fails", async () => {
    vi.mocked(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: "Erreur lors de la suppression." }),
    } as Response);

    render(<AliasManager initialAliases={ALIASES} />);
    fireEvent.click(screen.getByLabelText("Supprimer l'alias michel"));
    fireEvent.click(screen.getByLabelText("Confirmer la suppression"));

    await waitFor(() => expect(screen.getByText("Erreur lors de la suppression.")).toBeTruthy());
    expect(screen.getByText("michel")).toBeTruthy(); // still in list
  });
});

describe("AliasManager — export", () => {
  it("triggers a JSON download", () => {
    render(<AliasManager initialAliases={ALIASES} />);
    fireEvent.click(screen.getByText("Exporter"));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("exports a JSON blob of the right type and size", () => {
    render(<AliasManager initialAliases={ALIASES} />);
    fireEvent.click(screen.getByText("Exporter"));
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("AliasManager — import", () => {
  it("imports new-format aliases and reloads the list", async () => {
    const newFormat: AliasData[] = [{ alias: "sarah", signs: ["verseau", "lion"] }];
    vi.mocked(fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 1, message: "1 alias importé" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ aliases: [...ALIASES, ...newFormat] }),
      } as Response);

    render(<AliasManager initialAliases={ALIASES} />);
    triggerFileInput(makeFileWithText(newFormat));

    await waitFor(() => expect(screen.getByText("1 alias importé")).toBeTruthy());
    const calls = vi.mocked(fetch as ReturnType<typeof vi.fn>).mock.calls;
    const bulk = calls.find((c) => (c[1] as RequestInit)?.method === "POST");
    const body = JSON.parse((bulk![1] as RequestInit).body as string) as {
      entries: AliasData[];
    };
    expect(body.entries[0]?.alias).toBe("sarah");
    expect(body.entries[0]?.signs).toEqual(["verseau", "lion"]);
  });

  it("imports old pseudo-format by grouping into aliases", async () => {
    const oldFormat = [
      { pseudo: "sarah", sign: "lion" },
      { pseudo: "sarah", sign: "cancer" }, // same pseudo → merged
      { pseudo: "bob", sign: "belier" },
    ];
    vi.mocked(fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ imported: 2, message: "2 alias importés" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ aliases: ALIASES }),
      } as Response);

    render(<AliasManager initialAliases={[]} />);
    triggerFileInput(makeFileWithText(oldFormat));

    await waitFor(() => expect(screen.getByText("2 alias importés")).toBeTruthy());
    const calls = vi.mocked(fetch as ReturnType<typeof vi.fn>).mock.calls;
    const bulk = calls.find((c) => (c[1] as RequestInit)?.method === "POST");
    const body = JSON.parse((bulk![1] as RequestInit).body as string) as {
      entries: AliasData[];
    };
    // sarah should have both signs merged
    const sarah = body.entries.find((e) => e.alias === "sarah");
    expect(sarah?.signs).toContain("lion");
    expect(sarah?.signs).toContain("cancer");
  });

  it("shows error for invalid JSON", async () => {
    render(<AliasManager initialAliases={[]} />);
    triggerFileInput(makeBadFile());
    await screen.findByText("Fichier JSON invalide.");
  });

  it("shows error when file is not an array", async () => {
    render(<AliasManager initialAliases={[]} />);
    triggerFileInput(makeFileWithText({ alias: "test", signs: [] }));
    await screen.findByText("Format invalide : tableau attendu.");
  });

  it("shows error when no valid entry is found", async () => {
    render(<AliasManager initialAliases={[]} />);
    triggerFileInput(makeFileWithText([{ foo: "bar" }]));
    await screen.findByText("Aucune entrée valide dans le fichier.");
  });
});
