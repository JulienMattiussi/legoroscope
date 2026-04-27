import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/discord", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/discord")>();
  return { ...actual, verifyDiscordSignature: vi.fn().mockReturnValue(true) };
});

vi.mock("@/lib/cache", () => ({
  getCachedHoroscope: vi.fn(),
  setCachedHoroscope: vi.fn().mockResolvedValue(undefined),
  getPseudoSign: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/scraper", () => ({
  scrapeAllHoroscopes: vi.fn().mockResolvedValue({}),
}));

import { POST } from "@/app/api/discord/route";
import { getCachedHoroscope, getPseudoSign } from "@/lib/cache";

function makeRequest(body: object): NextRequest {
  const json = JSON.stringify(body);
  return {
    text: () => Promise.resolve(json),
    headers: { get: (h: string) => (h === "x-signature-ed25519" ? "sig" : "ts") },
  } as unknown as NextRequest;
}

const cached = (text: string) => ({ text, fetchedAt: "", strategy: "css" as const });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedHoroscope).mockResolvedValue(cached("Horoscope test."));
  vi.mocked(getPseudoSign).mockResolvedValue(null);
});

describe("Discord route — multiple signs", () => {
  it("returns one line per sign", async () => {
    const res = await POST(
      makeRequest({
        type: 2,
        data: {
          options: [
            { name: "signe", value: "lion" },
            { name: "signe2", value: "cancer" },
          ],
        },
      }),
    );
    const { data } = await res.json();
    expect(data.content).toContain("Lion");
    expect(data.content).toContain("Cancer");
    expect(data.content.split("\n")).toHaveLength(2);
  });

  it("deduplicates identical sign inputs", async () => {
    const res = await POST(
      makeRequest({
        type: 2,
        data: {
          options: [
            { name: "signe", value: "lion" },
            { name: "signe2", value: "lion" },
          ],
        },
      }),
    );
    const { data } = await res.json();
    expect(data.content.split("\n")).toHaveLength(1);
  });

  it("resolves a pseudo to its sign", async () => {
    vi.mocked(getPseudoSign).mockResolvedValue({ sign: "scorpion", userId: "u1" });
    const res = await POST(
      makeRequest({
        type: 2,
        data: { options: [{ name: "signe", value: "michel" }] },
      }),
    );
    const { data } = await res.json();
    expect(data.content).toContain("Scorpion");
  });

  it("returns an error when all inputs are unknown", async () => {
    const res = await POST(
      makeRequest({
        type: 2,
        data: { options: [{ name: "signe", value: "xyz" }] },
      }),
    );
    const { data } = await res.json();
    expect(data.content).toContain('"xyz"');
    expect(data.content).toContain("aucun signe");
  });

  it("accepts tolerant sign names (singular, accents, case)", async () => {
    const res = await POST(
      makeRequest({
        type: 2,
        data: {
          options: [
            { name: "signe", value: "poisson" },
            { name: "signe2", value: "LION" },
            { name: "signe3", value: "bélier" },
          ],
        },
      }),
    );
    const { data } = await res.json();
    expect(data.content).toContain("Poissons");
    expect(data.content).toContain("Lion");
    expect(data.content).toContain("Bélier");
    expect(data.content.split("\n")).toHaveLength(3);
  });
});
