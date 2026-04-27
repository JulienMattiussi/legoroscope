import { describe, it, expect } from "vitest";
import { handleInteraction, autocompleteSign } from "@/lib/discord";

const sign = (label: string, horoscope: string | null) => ({
  label,
  emoji: "♈",
  horoscope,
});

describe("handleInteraction", () => {
  it("responds with PONG for PING interaction", () => {
    const res = handleInteraction({ type: 1 }, [sign("Lion", null)]);
    expect(res.type).toBe(1);
  });

  it("returns horoscope text for APPLICATION_COMMAND", () => {
    const res = handleInteraction({ type: 2 }, [sign("Scorpion", "Les astres te sourient.")]);
    expect(res.type).toBe(4);
    expect(res.data?.content).toContain("Scorpion");
    expect(res.data?.content).toContain("Les astres te sourient.");
  });

  it("returns unavailable marker when horoscope is null", () => {
    const res = handleInteraction({ type: 2 }, [sign("Vierge", null)]);
    expect(res.type).toBe(4);
    expect(res.data?.content).toContain("Vierge");
    expect(res.data?.content).toContain("non disponible");
  });

  it("formats multiple signs as separate lines", () => {
    const res = handleInteraction({ type: 2 }, [
      sign("Lion", "Horoscope du Lion."),
      sign("Cancer", "Horoscope du Cancer."),
    ]);
    expect(res.data?.content).toContain("Lion");
    expect(res.data?.content).toContain("Cancer");
    expect(res.data?.content?.split("\n")).toHaveLength(2);
  });

  it("returns fallback for unknown interaction type", () => {
    const res = handleInteraction({ type: 99 }, [sign("Lion", null)]);
    expect(res.type).toBe(4);
  });
});

describe("autocompleteSign", () => {
  it("returns all 13 signs when input is empty", () => {
    expect(autocompleteSign("")).toHaveLength(13);
  });

  it("filters signs by slug prefix", () => {
    const results = autocompleteSign("sc");
    expect(results.map((r) => r.value)).toContain("scorpion");
    expect(results.map((r) => r.value)).not.toContain("lion");
  });

  it("filters signs by label prefix (with accents)", () => {
    const results = autocompleteSign("gé");
    expect(results.map((r) => r.value)).toContain("gemeaux");
  });

  it("is case insensitive", () => {
    const results = autocompleteSign("LI");
    expect(results.map((r) => r.value)).toContain("lion");
  });

  it("includes emoji and label in the name", () => {
    const result = autocompleteSign("lion")[0];
    expect(result.name).toContain("♌");
    expect(result.name).toContain("Lion");
    expect(result.value).toBe("lion");
  });

  it("returns empty array for unknown prefix", () => {
    expect(autocompleteSign("xyz")).toHaveLength(0);
  });
});
