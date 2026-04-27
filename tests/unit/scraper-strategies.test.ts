import { describe, it, expect } from "vitest";
import { extractSignsFromArticle } from "@/lib/scraper/css";
import { findArticleUrlWithRegex, extractSignsWithRegex } from "@/lib/scraper/regex";

// Minimal HTML mimicking the real Gorafi article structure
const ARTICLE_HTML = `
<div id="mvp-post-content">
  <p><strong>Bélier : </strong>Vous aurez une excellente semaine.</p>
  <p><strong>Taureau : </strong>Les astres vous sourient.</p>
  <p><strong>Furet : </strong>Le furet bonus du Gorafi.</p>
  <p>Un paragraphe sans strong, ignoré.</p>
</div>
`;

const CATEGORY_HTML = `
<html><body>
  <a href="https://www.legorafi.fr/2026/04/27/horoscope-du-27-avril-2026/">Lire l'horoscope</a>
  <a href="https://www.legorafi.fr/autres/article/">Autre article</a>
</body></html>
`;

describe("CSS strategy — extractSignsFromArticle", () => {
  it("extracts known signs from article HTML", () => {
    const results = extractSignsFromArticle(ARTICLE_HTML);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
    expect(results.taureau).toBe("Les astres vous sourient.");
  });

  it("ignores unknown signs like Furet", () => {
    const results = extractSignsFromArticle(ARTICLE_HTML);
    expect(Object.keys(results)).not.toContain("furet");
  });

  it("ignores paragraphs without a <strong> tag", () => {
    const results = extractSignsFromArticle(ARTICLE_HTML);
    // Only 2 known signs in the fixture
    expect(Object.keys(results)).toHaveLength(2);
  });
});

describe("Regex strategy — findArticleUrlWithRegex", () => {
  it("finds the horoscope article URL in category page HTML", () => {
    const url = findArticleUrlWithRegex(CATEGORY_HTML);
    expect(url).toBe("https://www.legorafi.fr/2026/04/27/horoscope-du-27-avril-2026/");
  });

  it("returns null if no horoscope URL is found", () => {
    expect(findArticleUrlWithRegex("<html>pas d'horoscope ici</html>")).toBeNull();
  });
});

describe("Regex strategy — extractSignsWithRegex", () => {
  it("extracts known signs from article HTML without a DOM parser", () => {
    const results = extractSignsWithRegex(ARTICLE_HTML);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
    expect(results.taureau).toBe("Les astres vous sourient.");
  });

  it("ignores unknown signs", () => {
    const results = extractSignsWithRegex(ARTICLE_HTML);
    expect(Object.keys(results)).not.toContain("furet");
  });
});
