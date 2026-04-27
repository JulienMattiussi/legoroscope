import { describe, it, expect } from "vitest";
import { SIGNS, SIGN_SLUGS, isValidSign, getSign } from "@/lib/signs";

describe("signs", () => {
  it("has exactly 13 signs", () => {
    expect(SIGNS).toHaveLength(13);
  });

  it("every sign has a slug, label and emoji", () => {
    for (const s of SIGNS) {
      expect(s.slug).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.emoji).toBeTruthy();
    }
  });

  it("SIGN_SLUGS contains all 13 slugs", () => {
    expect(SIGN_SLUGS).toHaveLength(13);
  });

  it("isValidSign returns true for known slugs", () => {
    expect(isValidSign("belier")).toBe(true);
    expect(isValidSign("poissons")).toBe(true);
    expect(isValidSign("scorpion")).toBe(true);
  });

  it("isValidSign returns false for unknown values", () => {
    expect(isValidSign("capricorn")).toBe(false);
    expect(isValidSign("")).toBe(false);
    expect(isValidSign("horoscope")).toBe(false);
  });

  it("getSign returns the matching sign object", () => {
    const s = getSign("lion");
    expect(s?.label).toBe("Lion");
    expect(s?.emoji).toBe("♌");
  });

  it("getSign returns null for unknown slug", () => {
    expect(getSign("xyz")).toBeNull();
  });
});
