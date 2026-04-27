import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PseudoGrid } from "@/components/PseudoGrid";
import type { PseudoEntry } from "@/components/PseudoGrid";

// jsdom does not implement these URL methods
Object.assign(URL, {
  createObjectURL: vi.fn(() => "blob:fake"),
  revokeObjectURL: vi.fn(),
});

const ENTRIES: PseudoEntry[] = [
  { pseudo: "michel", sign: "cancer" },
  { pseudo: "pierre", sign: "lion" },
];

function makeFileWithText(content: unknown) {
  const text = JSON.stringify(content);
  const file = { text: () => Promise.resolve(text) } as File;
  return file;
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
      json: () => Promise.resolve({ pseudos: ENTRIES }),
    }),
  );
});

describe("PseudoGrid — export", () => {
  it("triggers a JSON download with all entries", () => {
    render(<PseudoGrid initialEntries={ENTRIES} />);
    fireEvent.click(screen.getByText("Exporter"));

    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it("exports a JSON blob of the right type and size", () => {
    render(<PseudoGrid initialEntries={ENTRIES} />);
    fireEvent.click(screen.getByText("Exporter"));

    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("PseudoGrid — import", () => {
  it("imports valid entries and shows success message", async () => {
    render(<PseudoGrid initialEntries={[]} />);
    triggerFileInput(makeFileWithText(ENTRIES));

    await screen.findByText("2 pseudos importés.");
  });

  it("shows error for invalid JSON", async () => {
    render(<PseudoGrid initialEntries={[]} />);
    triggerFileInput(makeBadFile());

    await screen.findByText("Fichier JSON invalide.");
  });

  it("shows error when file is not an array", async () => {
    render(<PseudoGrid initialEntries={[]} />);
    triggerFileInput(makeFileWithText({ pseudo: "michel", sign: "cancer" }));

    await screen.findByText("Format invalide : tableau attendu.");
  });

  it("filters out entries with unknown signs", async () => {
    const mixed = [
      { pseudo: "michel", sign: "cancer" },
      { pseudo: "invalid", sign: "xyz" },
    ];
    render(<PseudoGrid initialEntries={[]} />);
    triggerFileInput(makeFileWithText(mixed));

    await screen.findByText("1 pseudo importé.");
  });

  it("shows error when no valid entry is found", async () => {
    render(<PseudoGrid initialEntries={[]} />);
    triggerFileInput(makeFileWithText([{ pseudo: "x", sign: "unknown" }]));

    await screen.findByText("Aucune entrée valide dans le fichier.");
  });

  it("reloads the list after import", async () => {
    const updated: PseudoEntry[] = [...ENTRIES, { pseudo: "sarah", sign: "verseau" }];
    vi.mocked(fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({ ok: true } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ pseudos: updated }),
      } as Response);

    render(<PseudoGrid initialEntries={[]} />);
    triggerFileInput(makeFileWithText(ENTRIES));

    await waitFor(() => {
      expect(screen.getByText("sarah")).toBeInTheDocument();
    });
  });
});
