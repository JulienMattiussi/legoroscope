import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/discord", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/discord")>();
  return { ...actual, verifyDiscordSignature: vi.fn().mockReturnValue(true) };
});

vi.mock("@/lib/cache", () => ({
  getCachedHoroscope: vi.fn(),
  getStaleCachedHoroscope: vi.fn().mockResolvedValue(null),
  setCachedHoroscope: vi.fn().mockResolvedValue(undefined),
  getAliasIndex: vi.fn().mockResolvedValue(null),
  getAllAliasNames: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/scraper", () => ({
  scrapeAllHoroscopes: vi.fn().mockResolvedValue({}),
}));

import { POST } from "@/app/api/discord/route";
import {
  getCachedHoroscope,
  setCachedHoroscope,
  getAliasIndex,
  getAllAliasNames,
} from "@/lib/cache";
import { scrapeAllHoroscopes } from "@/lib/scraper";

function makeRequest(body: object): NextRequest {
  const json = JSON.stringify(body);
  return {
    text: () => Promise.resolve(json),
    headers: { get: (h: string) => (h === "x-signature-ed25519" ? "sig" : "ts") },
  } as unknown as NextRequest;
}

const fresh = (text: string) => ({ text, fetchedAt: "", strategy: "css" as const });
const stale = (text: string) => ({
  text,
  fetchedAt: "",
  strategy: "stale" as const,
  stale: true as const,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCachedHoroscope).mockResolvedValue(fresh("Horoscope test."));
  vi.mocked(getAliasIndex).mockResolvedValue(null);
});

describe("Discord route - multiple signs", () => {
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

  it("resolves an alias covering one sign", async () => {
    vi.mocked(getAliasIndex).mockResolvedValue({ signs: ["scorpion"], userId: "u1" });
    const res = await POST(
      makeRequest({
        type: 2,
        data: { options: [{ name: "signe", value: "michel" }] },
      }),
    );
    const { data } = await res.json();
    expect(data.content).toContain("Scorpion");
  });

  it("resolves an alias covering multiple signs - returns one line per sign", async () => {
    vi.mocked(getAliasIndex).mockResolvedValue({ signs: ["lion", "cancer"], userId: "u1" });
    const res = await POST(
      makeRequest({
        type: 2,
        data: { options: [{ name: "signe", value: "michel" }] },
      }),
    );
    const { data } = await res.json();
    expect(data.content).toContain("Lion");
    expect(data.content).toContain("Cancer");
    expect(data.content.split("\n")).toHaveLength(2);
  });

  it("deduplicates when alias sign overlaps with explicit sign input", async () => {
    vi.mocked(getAliasIndex).mockResolvedValue({ signs: ["lion", "cancer"], userId: "u1" });
    const res = await POST(
      makeRequest({
        type: 2,
        data: {
          options: [
            { name: "signe", value: "lion" }, // explicit lion
            { name: "signe2", value: "michel" }, // alias covers lion + cancer
          ],
        },
      }),
    );
    const { data } = await res.json();
    // lion appears only once despite being in both
    expect(data.content.split("\n").filter((l: string) => l.includes("Lion"))).toHaveLength(1);
    expect(data.content).toContain("Cancer");
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

describe("Discord route - cache miss triggers scraping", () => {
  it("scrapes when cache is absent and returns fresh text", async () => {
    vi.mocked(getCachedHoroscope).mockResolvedValue(null);
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({
      lion: { text: "Horoscope semaine courante.", strategy: "css", sourceUrl: "http://x" },
    });

    const res = await POST(
      makeRequest({ type: 2, data: { options: [{ name: "signe", value: "lion" }] } }),
    );
    const { data } = await res.json();

    expect(scrapeAllHoroscopes).toHaveBeenCalledOnce();
    expect(setCachedHoroscope).toHaveBeenCalled();
    expect(data.content).toContain("Horoscope semaine courante.");
  });

  it("does not scrape when cache is fresh", async () => {
    vi.mocked(getCachedHoroscope).mockResolvedValue(fresh("Horoscope frais."));

    await POST(makeRequest({ type: 2, data: { options: [{ name: "signe", value: "lion" }] } }));

    expect(scrapeAllHoroscopes).not.toHaveBeenCalled();
  });
});

describe("Discord route - autocomplete", () => {
  it("returns sign choices for a sign prefix", async () => {
    const res = await POST(
      makeRequest({ type: 4, data: { options: [{ name: "signe", value: "li", focused: true }] } }),
    );
    const { data } = await res.json();
    expect(data.choices.map((c: { value: string }) => c.value)).toContain("lion");
  });

  it("includes alias choices when aliases match the prefix", async () => {
    vi.mocked(getAllAliasNames).mockResolvedValueOnce(["michel", "michelle", "caroline"]);
    const res = await POST(
      makeRequest({ type: 4, data: { options: [{ name: "signe", value: "mi", focused: true }] } }),
    );
    const { data } = await res.json();
    const values = data.choices.map((c: { value: string }) => c.value);
    expect(values).toContain("michel");
    expect(values).toContain("michelle");
    expect(values).not.toContain("caroline");
  });

  it("returns at most 25 choices", async () => {
    vi.mocked(getAllAliasNames).mockResolvedValueOnce(
      Array.from({ length: 30 }, (_, i) => `alias${i}`),
    );
    const res = await POST(
      makeRequest({ type: 4, data: { options: [{ name: "signe", value: "a", focused: true }] } }),
    );
    const { data } = await res.json();
    expect(data.choices.length).toBeLessThanOrEqual(25);
  });
});
