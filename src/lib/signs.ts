export const SIGNS = [
  { slug: "belier", label: "Bélier", emoji: "♈" },
  { slug: "taureau", label: "Taureau", emoji: "♉" },
  { slug: "gemeaux", label: "Gémeaux", emoji: "♊" },
  { slug: "cancer", label: "Cancer", emoji: "♋" },
  { slug: "lion", label: "Lion", emoji: "♌" },
  { slug: "vierge", label: "Vierge", emoji: "♍" },
  { slug: "balance", label: "Balance", emoji: "♎" },
  { slug: "scorpion", label: "Scorpion", emoji: "♏" },
  { slug: "sagittaire", label: "Sagittaire", emoji: "♐" },
  { slug: "capricorne", label: "Capricorne", emoji: "♑" },
  { slug: "verseau", label: "Verseau", emoji: "♒" },
  { slug: "poissons", label: "Poissons", emoji: "♓" },
  { slug: "furet", label: "Furet", emoji: "🐾" },
] as const;

export type Sign = (typeof SIGNS)[number]["slug"];

export const SIGN_SLUGS = SIGNS.map((s) => s.slug) as Sign[];

export function isValidSign(value: string): value is Sign {
  return (SIGN_SLUGS as string[]).includes(value);
}

export function getSign(slug: string) {
  return SIGNS.find((s) => s.slug === slug) ?? null;
}
