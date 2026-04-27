import { describe, it, expect } from "vitest";
import { handleInteraction } from "@/lib/discord";

describe("handleInteraction", () => {
  it("responds with PONG for PING interaction", () => {
    const res = handleInteraction({ type: 1 }, null, "Lion");
    expect(res.type).toBe(1);
  });

  it("returns horoscope text for APPLICATION_COMMAND", () => {
    const res = handleInteraction({ type: 2 }, "Les astres te sourient.", "Scorpion");
    expect(res.type).toBe(4);
    expect(res.data?.content).toContain("Scorpion");
    expect(res.data?.content).toContain("Les astres te sourient.");
  });

  it("returns unavailable message when horoscope is null", () => {
    const res = handleInteraction({ type: 2 }, null, "Vierge");
    expect(res.type).toBe(4);
    expect(res.data?.content).toContain("Vierge");
  });

  it("returns fallback for unknown interaction type", () => {
    const res = handleInteraction({ type: 99 }, null, "Lion");
    expect(res.type).toBe(4);
  });
});
