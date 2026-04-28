import { describe, it, expect } from "vitest";
import { extractSignsFromArticle } from "@/lib/scraper/css";
import {
  extractLatestArticleUrl,
  extractFromRssInlineContent,
  extractSignsFromParagraphs,
} from "@/lib/scraper/rss";
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

describe("CSS strategy - extractSignsFromArticle", () => {
  it("extracts known signs from article HTML", () => {
    const results = extractSignsFromArticle(ARTICLE_HTML);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
    expect(results.taureau).toBe("Les astres vous sourient.");
  });

  it("extracts the Furet bonus sign when present", () => {
    const results = extractSignsFromArticle(ARTICLE_HTML);
    expect(results.furet).toBe("Le furet bonus du Gorafi.");
  });

  it("ignores paragraphs without a <strong> tag", () => {
    const results = extractSignsFromArticle(ARTICLE_HTML);
    // belier + taureau + furet
    expect(Object.keys(results)).toHaveLength(3);
  });
});

const RSS_WITH_LINK = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
  <item>
    <link>https://www.legorafi.fr/2026/04/27/horoscope-du-27-avril-2026/</link>
    <encoded>
      &lt;p&gt;&lt;strong&gt;Bélier : &lt;/strong&gt;Vous aurez une excellente semaine.&lt;/p&gt;
      &lt;p&gt;&lt;strong&gt;Taureau : &lt;/strong&gt;Les astres vous sourient.&lt;/p&gt;
    </encoded>
  </item>
</channel></rss>`;

const RSS_WITH_DESCRIPTION_ONLY = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <link>https://www.legorafi.fr/2026/04/27/horoscope-du-27-avril-2026/</link>
    <description><![CDATA[
      <p><strong>Bélier : </strong>Vous aurez une excellente semaine.</p>
    ]]></description>
  </item>
</channel></rss>`;

const RSS_NO_LINK = `<?xml version="1.0"?>
<rss><channel><item><title>no link here</title></item></channel></rss>`;

describe("RSS strategy - extractLatestArticleUrl", () => {
  it("extracts the article URL from the first <item>", () => {
    const url = extractLatestArticleUrl(RSS_WITH_LINK);
    expect(url).toBe("https://www.legorafi.fr/2026/04/27/horoscope-du-27-avril-2026/");
  });

  it("returns null when no <link> is present", () => {
    expect(extractLatestArticleUrl(RSS_NO_LINK)).toBeNull();
  });
});

describe("RSS strategy - extractFromRssInlineContent", () => {
  it("extracts signs from <content:encoded>", () => {
    const results = extractFromRssInlineContent(RSS_WITH_LINK);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
    expect(results.taureau).toBe("Les astres vous sourient.");
  });

  it("falls back to <description> when <content:encoded> is absent", () => {
    const results = extractFromRssInlineContent(RSS_WITH_DESCRIPTION_ONLY);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
  });

  it("returns empty object when feed has no item", () => {
    expect(extractFromRssInlineContent(RSS_NO_LINK)).toEqual({});
  });
});

describe("Regex strategy - findArticleUrlWithRegex", () => {
  it("finds the horoscope article URL in category page HTML", () => {
    const url = findArticleUrlWithRegex(CATEGORY_HTML);
    expect(url).toBe("https://www.legorafi.fr/2026/04/27/horoscope-du-27-avril-2026/");
  });

  it("returns null if no horoscope URL is found", () => {
    expect(findArticleUrlWithRegex("<html>pas d'horoscope ici</html>")).toBeNull();
  });
});

describe("RSS strategy - extractSignsFromParagraphs", () => {
  it("extracts signs from paragraphs with <strong> labels", () => {
    const html = `
      <p><strong>Bélier : </strong>Vous aurez une excellente semaine.</p>
      <p><strong>Taureau : </strong>Les astres vous sourient.</p>
    `;
    const results = extractSignsFromParagraphs(html);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
    expect(results.taureau).toBe("Les astres vous sourient.");
  });

  it("ignores paragraphs without a <strong> tag", () => {
    const html = `<p>Un paragraphe ordinaire sans balise strong.</p>`;
    expect(extractSignsFromParagraphs(html)).toEqual({});
  });

  it("ignores <strong> text that does not match any sign label", () => {
    const html = `<p><strong>Introduction : </strong>Voici le texte.</p>`;
    expect(extractSignsFromParagraphs(html)).toEqual({});
  });

  it("ignores paragraphs whose prediction is too short", () => {
    const html = `<p><strong>Lion : </strong>Ok.</p>`;
    expect(extractSignsFromParagraphs(html)).toEqual({});
  });

  it("handles case-insensitive sign matching", () => {
    const html = `<p><strong>LION : </strong>Une prédiction suffisamment longue pour être retenue.</p>`;
    const results = extractSignsFromParagraphs(html);
    expect(results.lion).toBeTruthy();
  });

  it("strips the trailing colon from the strong label", () => {
    const html = `<p><strong>Verseau :</strong>L'eau sera votre alliée cette semaine sans aucun doute.</p>`;
    const results = extractSignsFromParagraphs(html);
    expect(results.verseau).toBeTruthy();
    expect(results.verseau).not.toContain(":");
  });
});

describe("Regex strategy - extractSignsWithRegex", () => {
  it("extracts known signs from article HTML without a DOM parser", () => {
    const results = extractSignsWithRegex(ARTICLE_HTML);
    expect(results.belier).toBe("Vous aurez une excellente semaine.");
    expect(results.taureau).toBe("Les astres vous sourient.");
  });

  it("extracts the Furet bonus sign when present", () => {
    const results = extractSignsWithRegex(ARTICLE_HTML);
    expect(results.furet).toBe("Le furet bonus du Gorafi.");
  });
});
