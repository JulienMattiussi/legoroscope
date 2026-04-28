import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PseudoManager } from "@/components/PseudoManager";

vi.stubGlobal("fetch", vi.fn());

beforeEach(() => {
  vi.clearAllMocks();
});

function mockFetchOk(body: object) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(body: object, status = 500) {
  (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("PseudoManager", () => {
  it("renders the initial list of pseudos", () => {
    render(<PseudoManager sign="lion" initialPseudos={["alpha", "beta"]} />);
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("beta")).toBeTruthy();
  });

  it("adds a pseudo on button click and updates the list", async () => {
    mockFetchOk({ pseudos: ["alpha", "gamma"] });
    render(<PseudoManager sign="lion" initialPseudos={["alpha"]} />);

    fireEvent.change(screen.getByPlaceholderText("Ajouter un pseudo…"), {
      target: { value: "gamma" },
    });
    fireEvent.click(screen.getByText("Ajouter"));

    await waitFor(() => expect(screen.getByText("gamma")).toBeTruthy());
    expect(fetch).toHaveBeenCalledWith(
      "/api/user/pseudos/lion",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("adds a pseudo on Enter key and clears the input", async () => {
    mockFetchOk({ pseudos: ["delta"] });
    render(<PseudoManager sign="belier" initialPseudos={[]} />);

    const input = screen.getByPlaceholderText("Ajouter un pseudo…");
    fireEvent.change(input, { target: { value: "delta" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("delta")).toBeTruthy());
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("shows a notification when a pseudo is moved from another sign", async () => {
    mockFetchOk({ pseudos: ["michel"], movedFrom: "Taureau" });
    render(<PseudoManager sign="lion" initialPseudos={[]} />);

    fireEvent.change(screen.getByPlaceholderText("Ajouter un pseudo…"), {
      target: { value: "michel" },
    });
    fireEvent.click(screen.getByText("Ajouter"));

    await waitFor(() =>
      expect(screen.getByText(/"michel" déplacé depuis le Taureau/)).toBeTruthy(),
    );
  });

  it("shows an error notification when the add request fails", async () => {
    mockFetchError({ error: "Ce nom est réservé." }, 400);
    render(<PseudoManager sign="lion" initialPseudos={[]} />);

    fireEvent.change(screen.getByPlaceholderText("Ajouter un pseudo…"), {
      target: { value: "lion" },
    });
    fireEvent.click(screen.getByText("Ajouter"));

    await waitFor(() => expect(screen.getByText("Ce nom est réservé.")).toBeTruthy());
  });

  it("deletes a pseudo on × click and updates the list", async () => {
    mockFetchOk({ pseudos: [] });
    render(<PseudoManager sign="lion" initialPseudos={["alpha"]} />);

    fireEvent.click(screen.getByLabelText("Supprimer alpha"));

    await waitFor(() => expect(screen.queryByText("alpha")).toBeNull());
    expect(fetch).toHaveBeenCalledWith(
      "/api/user/pseudos/lion",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows an error notification when the delete request fails", async () => {
    mockFetchError({ error: "Erreur lors de la suppression." });
    render(<PseudoManager sign="lion" initialPseudos={["alpha"]} />);

    fireEvent.click(screen.getByLabelText("Supprimer alpha"));

    await waitFor(() => expect(screen.getByText("Erreur lors de la suppression.")).toBeTruthy());
    expect(screen.getByText("alpha")).toBeTruthy();
  });
});
