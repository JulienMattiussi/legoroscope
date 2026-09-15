import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/cache", () => ({
  pingCache: vi.fn(),
}));

import { GET } from "@/app/api/cron/keepalive/route";
import { pingCache } from "@/lib/cache";

function makeRequest(authorization?: string): NextRequest {
  return {
    headers: { get: (h: string) => (h === "authorization" ? (authorization ?? null) : null) },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "s3cret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/keepalive", () => {
  it("pings Redis and returns the stored timestamp", async () => {
    vi.mocked(pingCache).mockResolvedValue("2026-09-15T06:00:00.000Z");

    const res = await GET(makeRequest("Bearer s3cret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, pingedAt: "2026-09-15T06:00:00.000Z" });
    expect(pingCache).toHaveBeenCalledTimes(1);
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(pingCache).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match CRON_SECRET", async () => {
    const res = await GET(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(pingCache).not.toHaveBeenCalled();
  });

  it("returns 401 when the token matches but the Bearer prefix is missing", async () => {
    const res = await GET(makeRequest("s3cret"));
    expect(res.status).toBe(401);
    expect(pingCache).not.toHaveBeenCalled();
  });

  it("stays closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const res = await GET(makeRequest("Bearer "));
    expect(res.status).toBe(401);
    expect(pingCache).not.toHaveBeenCalled();
  });

  it("returns 503 when the read back comes up empty", async () => {
    vi.mocked(pingCache).mockResolvedValue(null);

    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(503);
  });

  it("returns 500 when the ping throws", async () => {
    vi.mocked(pingCache).mockRejectedValue(new Error("connection refused"));

    const res = await GET(makeRequest("Bearer s3cret"));
    expect(res.status).toBe(500);
  });
});
