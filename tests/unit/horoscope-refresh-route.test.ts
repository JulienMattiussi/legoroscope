import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  setCachedHoroscope: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/scraper", () => ({
  scrapeAllHoroscopes: vi.fn(),
}));

import { POST } from "@/app/api/horoscopes/refresh/route";
import { requireUserId } from "@/lib/auth";
import { setCachedHoroscope } from "@/lib/cache";
import { scrapeAllHoroscopes } from "@/lib/scraper";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/horoscopes/refresh", () => {
  it("returns 401 when caller is not authenticated", async () => {
    vi.mocked(requireUserId).mockResolvedValue(
      NextResponse.json({ error: "Non authentifié." }, { status: 401 }),
    );

    const res = await POST();
    expect(res.status).toBe(401);
    expect(scrapeAllHoroscopes).not.toHaveBeenCalled();
    expect(setCachedHoroscope).not.toHaveBeenCalled();
  });

  it("scrapes and overwrites cache for every scraped sign", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-123");
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({
      lion: { text: "Nouveau lion.", strategy: "css", sourceUrl: "http://x" },
      cancer: { text: "Nouveau cancer.", strategy: "css", sourceUrl: "http://x" },
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshed).toBe(2);
    expect(setCachedHoroscope).toHaveBeenCalledTimes(2);
    expect(setCachedHoroscope).toHaveBeenCalledWith("lion", {
      text: "Nouveau lion.",
      strategy: "css",
      sourceUrl: "http://x",
    });
    expect(setCachedHoroscope).toHaveBeenCalledWith("cancer", {
      text: "Nouveau cancer.",
      strategy: "css",
      sourceUrl: "http://x",
    });
  });

  it("ignores entries whose key is not a valid sign", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-123");
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({
      lion: { text: "Nouveau lion.", strategy: "css", sourceUrl: "http://x" },
      // @ts-expect-error - simulate stray key that should be filtered out
      bogus: { text: "Bogus.", strategy: "css" },
    });

    const res = await POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.refreshed).toBe(1);
    expect(setCachedHoroscope).toHaveBeenCalledTimes(1);
    expect(setCachedHoroscope).toHaveBeenCalledWith("lion", expect.any(Object));
  });

  it("returns 503 when scraping yields nothing", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-123");
    vi.mocked(scrapeAllHoroscopes).mockResolvedValue({});

    const res = await POST();
    expect(res.status).toBe(503);
    expect(setCachedHoroscope).not.toHaveBeenCalled();
  });

  it("returns 500 when scraping throws", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-123");
    vi.mocked(scrapeAllHoroscopes).mockRejectedValue(new Error("boom"));

    const res = await POST();
    expect(res.status).toBe(500);
    expect(setCachedHoroscope).not.toHaveBeenCalled();
  });
});
