<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Legoroscope

Horoscope scraper from Le Gorafi, served via a Next.js API, displayed in a Discord bot and a web frontend with GitHub OAuth login.

## What this project is

- **API**: scrapes Le Gorafi horoscopes (12 zodiac signs), caches results by week in Vercel KV, serves each sign on a dedicated route.
- **Discord**: slash-command bot using Discord Interactions webhooks (serverless-compatible, no persistent gateway connection).
- **Frontend**: Next.js web app with GitHub OAuth (NextAuth) to display horoscopes and link a GitHub account to a zodiac sign.

Deployed on Vercel free tier.

## Stack

- **Next.js 15** — App Router, TypeScript strict, API routes as Route Handlers
- **Vercel KV** (Upstash Redis) — weekly horoscope cache + user↔sign associations
- **NextAuth v5** — GitHub OAuth session management
- **cheerio** — HTML scraping (strategy 1)
- **Vitest** + `@testing-library/react` — unit and component tests
- **Playwright** — e2e tests
- **Prettier** — formatting
- **ESLint** — linting
- **npm** — package manager

## Project structure

```
src/
├── app/
│   ├── page.tsx                        # Home — grid of 12 signs
│   ├── [sign]/page.tsx                 # Single sign page
│   ├── profile/page.tsx                # Link GitHub account to a sign
│   └── api/
│       ├── horoscope/[sign]/route.ts   # GET → scrape + KV cache
│       ├── horoscopes/route.ts         # GET → all 12 signs at once
│       ├── discord/route.ts            # POST → Discord interactions
│       ├── user/sign/route.ts          # GET/POST → user↔sign association
│       └── auth/[...nextauth]/route.ts
├── lib/
│   ├── scraper/
│   │   ├── index.ts       # orchestrates strategies with fallback
│   │   ├── css.ts         # strategy 1: cheerio CSS selectors
│   │   ├── rss.ts         # strategy 2: RSS/Atom feed
│   │   └── regex.ts       # strategy 3: regex on raw HTML
│   ├── cache.ts           # Vercel KV helpers (key schema, TTL, stale fallback)
│   ├── discord.ts         # Ed25519 signature verification + command dispatch
│   ├── auth.ts            # NextAuth config (GitHub provider)
│   └── signs.ts           # SIGNS array + slug helpers
├── components/
│   ├── HoroscopeCard.tsx
│   └── SignPicker.tsx
└── styles/
    └── theme.css          # CSS custom properties — all colors live here
tests/
├── unit/          # Vitest — pure logic (scraper, cache key, discord sig)
├── component/     # Vitest + Testing Library
└── e2e/           # Playwright
```

## Signs

Slugs: `belier`, `taureau`, `gemeaux`, `cancer`, `lion`, `vierge`, `balance`, `scorpion`, `sagittaire`, `capricorne`, `verseau`, `poissons`.

## KV key schema

| Key                              | Value                                           |
| -------------------------------- | ----------------------------------------------- |
| `horoscope:{year}:{week}:{sign}` | `{ text, fetchedAt, strategy }`                 |
| `horoscope:stale:{sign}`         | last known good `{ text, fetchedAt, strategy }` |
| `user:{githubId}:sign`           | `"scorpion"`                                    |

## Scraper strategies (ordered, with fallback)

1. **CSS** (`src/lib/scraper/css.ts`) — cheerio + DOM selectors on the Gorafi horoscope page.
2. **RSS** (`src/lib/scraper/rss.ts`) — parse the Gorafi RSS/Atom feed (WordPress `/feed/?cat=horoscope` or similar).
3. **Regex** (`src/lib/scraper/regex.ts`) — pattern matching on raw HTML, does not depend on DOM structure.
4. **Stale cache** (handled in `src/lib/cache.ts`) — return the last known good value with `stale: true` if all strategies fail.

`scrapeHoroscope(sign)` tries each strategy in order, logs which strategy succeeded (`strategy` field in the cached result), and throws `ScrapingError` only if all three fail (after which the caller falls back to stale KV).

## Discord

Uses Discord Interactions (slash commands via webhook endpoint `/api/discord`). No persistent bot gateway needed — the endpoint receives `POST` requests from Discord, verifies the Ed25519 signature with `tweetnacl`, and returns a response JSON.

Register the `/horoscope <signe>` command once via the Discord REST API (a one-off script in `scripts/register-discord-command.ts`).

## Authentication

GitHub OAuth via NextAuth v5. Required env vars:

```
AUTH_SECRET=              # random 32-char secret
AUTH_GITHUB_ID=           # GitHub OAuth App client ID
AUTH_GITHUB_SECRET=       # GitHub OAuth App client secret
KV_URL=                   # Vercel KV connection string
KV_REST_API_URL=
KV_REST_API_TOKEN=
DISCORD_PUBLIC_KEY=       # for Ed25519 signature verification
DISCORD_APPLICATION_ID=
DISCORD_BOT_TOKEN=        # for registering commands
```

## Current status (as of 2026-04-27)

All three phases are functionally complete. The codebase compiles and the unit test suite passes.

### Done
- **Scraper** — 3 strategies (CSS, RSS, regex) with fallback orchestrator; `scrapeAllHoroscopes()` bulk-fetches all signs in one HTTP round-trip.
- **KV cache** — weekly key + stale fallback; all reads/writes go through `src/lib/cache.ts`.
- **API routes** — `/api/horoscope/[sign]`, `/api/horoscopes`, `/api/discord`, `/api/user/sign`, `/api/auth/[...nextauth]`.
- **Discord** — Ed25519 verification + command dispatch; `/api/discord` handles PING and `APPLICATION_COMMAND`.
- **Auth** — NextAuth v5 GitHub OAuth; `session.user.id` exposed for KV lookups.
- **Frontend** — Home grid, sign detail page, profile/sign-picker page; layout with session-aware nav.
- **Unit tests** — `tests/unit/`: scraper strategies, orchestrator, cache, discord sig, signs.

### Still missing
- `scripts/register-discord-command.ts` — one-off script to register `/horoscope <signe>` via the Discord REST API. Needs `DISCORD_APPLICATION_ID` + `DISCORD_BOT_TOKEN`.
- `tests/component/` — component tests with Vitest + Testing Library (directory exists, no files yet).
- `tests/e2e/` — Playwright e2e tests (directory exists, no files yet).
- Vercel deployment + env vars not wired up yet.

### Notes
- Tailwind CSS is installed (came with create-next-app) but **not used** — all styling uses inline styles + CSS custom properties from `src/styles/theme.css`. Do not add Tailwind classes.
- The profile page (`/profile`) silently does nothing when the user is not logged in (the API returns 401, the page swallows it). It does not redirect to `/api/auth/signin` yet.

## Coding rules

- **TypeScript strict** — no implicit `any`, `noUncheckedIndexedAccess` enabled.
- **Code and comments in English.** UI copy can be in French since the product is French.
- **Theme values in `src/styles/theme.css`** as CSS custom properties. Never hardcode colors in components — always `var(--token)`.
- **No speculative abstractions.** Don't add helpers, fallbacks or features that aren't required by the current task.
- **All scraper strategies must be independently testable** (pure functions accepting a `sign` parameter, returning `string | null`).
- **No network calls in unit tests** — mock at the strategy boundary.
- **KV reads/writes via `src/lib/cache.ts`** — never call `@vercel/kv` directly in route handlers.
- **Run `make check` before committing.**

## Commands

```bash
make install      # npm install + playwright install
make dev          # Next.js dev server (http://localhost:3000)
make build        # production build
make test         # unit + e2e
make test-unit    # vitest run
make test-watch   # vitest watch
make test-e2e     # playwright test
make typecheck    # tsc --noEmit
make lint         # eslint
make format       # prettier --write
make format-check # prettier --check
make check        # format-check + lint + typecheck + test-unit
make clean        # rm -rf .next dist
```
