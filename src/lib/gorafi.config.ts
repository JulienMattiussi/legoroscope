/**
 * Gorafi scraping configuration.
 * Update URLs here if the site moves or restructures, and selectors if the DOM changes.
 */
export const GORAFI_CONFIG = {
  /** Category archive page — lists the weekly horoscope articles */
  categoryUrl: "https://www.legorafi.fr/category/horoscope-2/",

  /** RSS/Atom feed for the horoscope category */
  rssFeedUrl: "https://www.legorafi.fr/category/horoscope-2/feed/",

  /**
   * CSS selectors for the article content.
   * The article page has:
   *   <div id="mvp-post-content">
   *     <p><strong>Bélier : </strong>prediction text…</p>
   *     <p><strong>Taureau : </strong>prediction text…</p>
   *     …
   *   </div>
   */
  selectors: {
    /** Wrapper div containing all sign paragraphs */
    contentWrapper: "#mvp-post-content",
    /** Each paragraph that holds a sign prediction */
    signParagraph: "#mvp-post-content p",
  },

  /**
   * Regex to identify horoscope article URLs on the category page.
   * Matches: /YYYY/MM/DD/horoscope-du-…/
   */
  articleUrlPattern: /\/\d{4}\/\d{2}\/\d{2}\/horoscope-du-/,

  /**
   * Scraping strategy order. The first strategy that returns ≥ 6 signs wins.
   * "rss"   — 1 HTTP request when inline content is complete (cheapest)
   * "css"   — 2 HTTP requests, most robust against DOM changes
   * "regex" — 2 HTTP requests, no DOM parser, resilient fallback
   */
  strategyOrder: ["css", "rss", "regex"] as const,
} as const;
