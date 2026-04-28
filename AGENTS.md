<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Legoroscope

Horoscope scraper from Le Gorafi, served via a Next.js API, displayed in a Discord bot and a web frontend with GitHub OAuth login.

## What this project is

- **API**: scrapes Le Gorafi horoscopes (13 signs including Furet), caches results by week in Redis, serves each sign on a dedicated route. Also resolves aliases to their associated signs.
- **Discord**: slash-command bot using Discord Interactions webhooks (serverless-compatible, no persistent gateway connection).
- **Frontend**: Next.js web app with GitHub OAuth (NextAuth) to display horoscopes and manage alias↔sign associations.

Deployed on Vercel free tier.

## Stack

- **Next.js 15** - App Router, TypeScript strict, API routes as Route Handlers
- **Redis Cloud** (`ioredis`) - weekly horoscope cache (8-day TTL) + user alias associations + alias index; `REDIS_URL` injected by Vercel at runtime (format: `redis://default:token@host:port`)
- **NextAuth v5** - GitHub OAuth session management
- **cheerio** - HTML scraping (CSS and RSS strategies)
- **Vitest** + `@testing-library/react` - unit and component tests
- **Playwright** - e2e tests
- **Prettier** - formatting
- **ESLint** - linting
- **npm** - package manager

## Project structure

```
src/
├── app/
│   ├── page.tsx                          # Home - grid of 13 signs with alias count + copy button
│   ├── [sign]/page.tsx                   # Single sign page (read-only horoscope)
│   ├── aliases/page.tsx                  # Alias manager - create/edit/delete aliases
│   └── api/
│       ├── horoscope/[sign]/route.ts     # GET → by sign slug (object) OR alias name (array)
│       ├── horoscopes/route.ts           # GET → all 13 signs at once
│       ├── discord/route.ts              # POST → Discord interactions
│       ├── user/aliases/route.ts         # GET → all aliases; POST → create or bulk import
│       ├── user/aliases/[alias]/route.ts # PUT → update signs; DELETE → delete alias
│       └── auth/[...nextauth]/route.ts
├── lib/
│   ├── scraper/
│   │   ├── index.ts       # orchestrates strategies with fallback (order from gorafi.config.ts)
│   │   ├── css.ts         # strategy: cheerio CSS selectors
│   │   ├── rss.ts         # strategy: RSS/Atom feed
│   │   └── regex.ts       # strategy: regex on raw HTML
│   ├── cache.ts           # Redis helpers (key schema, TTL, stale fallback, alias index)
│   ├── discord.ts         # Ed25519 signature verification + command dispatch
│   ├── auth.ts            # NextAuth config (GitHub provider, ALLOWED_GITHUB_LOGIN)
│   ├── gorafi.config.ts   # scraping URLs, selectors, and strategy order
│   └── signs.ts           # SIGNS array + slug helpers
├── components/
│   ├── HoroscopeCard.tsx  # card: Link body (sign detail) + copy button top-right
│   ├── CopyButton.tsx     # client component - clipboard copy with 2s feedback
│   └── AliasManager.tsx   # client component - full alias CRUD with sign chips, export/import
└── styles/
    └── theme.css          # CSS custom properties - all colors live here
tests/
├── unit/          # Vitest - pure logic (scraper, cache key, discord sig)
├── component/     # Vitest + Testing Library
└── e2e/           # Playwright
```

## Signs

Slugs: `belier`, `taureau`, `gemeaux`, `cancer`, `lion`, `vierge`, `balance`, `scorpion`, `sagittaire`, `capricorne`, `verseau`, `poissons`, `furet`.

Le Furet est le 13e signe bonus du Gorafi - présent occasionnellement dans les articles, absent le reste du temps (la page affiche alors "non disponible").

## Redis key schema

| Key                              | Value                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| `horoscope:{year}:{week}:{sign}` | `{ text, fetchedAt, strategy, sourceUrl }`                 |
| `horoscope:stale:{sign}`         | last known good `{ text, fetchedAt, strategy, sourceUrl }` |
| `user:{githubId}:alias:{lower}`  | `["sign1", "sign2"]` - signs covered by this alias         |
| `alias:{lower}`                  | `{ signs, userId }` - global reverse index                 |

## Aliases

Users associate game names (aliases) with one or more zodiac signs. Constraints:

- An alias is globally unique (case-insensitive). Two users cannot share the same alias name.
- An alias can cover any number of signs (including zero - it is stored but ignored for lookups).
- Sign slugs are forbidden as alias names to avoid route collisions on `/api/horoscope/[identifier]`.
- The global reverse index (`alias:{lower}`) allows `GET /api/horoscope/[identifier]` to resolve an alias to its signs without scanning all users.
- When resolving an alias that covers multiple signs, the horoscope endpoint returns an **array** of horoscope objects (one per sign). A sign slug always returns a single object.
- Import accepts two formats: new (`[{alias, signs:[…]}]`) and old pseudo format (`[{pseudo, sign}]`). Old-format entries with the same pseudo name are merged into one alias with all their signs combined.

## Scraper strategies

Strategy order is configured in `src/lib/gorafi.config.ts` (`strategyOrder`). The first strategy that returns ≥ 6 signs wins; falls through to the next on failure or insufficient results.

| Strategy  | HTTP requests                          | Notes         |
| --------- | -------------------------------------- | ------------- |
| **css**   | 2 - category page + article            | most robust   |
| **rss**   | 1 when inline content complete, else 2 | cheapest      |
| **regex** | 2 - category page + article            | no DOM parser |

Current order: `["css", "rss", "regex"]`. To change it, edit `strategyOrder` in `gorafi.config.ts`.

Each strategy returns a `StrategyOutput` (`{ results, sourceUrl }`), exported from `scraper/index.ts`. The `sourceUrl` (specific article URL) is stored in the cache and shown as a link on the home page.

After all strategies fail, the caller falls back to stale cache (returned with `stale: true`).

All pure parsing functions (`extractSignsFromArticle`, `extractSignsWithRegex`, `extractLatestArticleUrl`, `extractFromRssInlineContent`, `extractSignsFromParagraphs`) are exported and covered by unit tests in `tests/unit/scraper-strategies.test.ts`.

## API routes

| Route                         | Method | Description                                                                               |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `/api/horoscope/[identifier]` | GET    | Sign slug → single horoscope object; alias name → array of `{sign, ...horoscope}` objects |
| `/api/horoscopes`             | GET    | All 13 signs at once                                                                      |
| `/api/user/aliases`           | GET    | All aliases with their signs, sorted alphabetically                                       |
| `/api/user/aliases`           | POST   | Create alias `{alias, signs}` or bulk import `{entries: [{alias, signs}]}` / old format   |
| `/api/user/aliases/[alias]`   | PUT    | Replace signs for an alias `{signs: [...]}`                                               |
| `/api/user/aliases/[alias]`   | DELETE | Delete an alias                                                                           |
| `/api/discord`                | POST   | Discord Interactions webhook                                                              |
| `/api/auth/[...nextauth]`     | -      | NextAuth handlers                                                                         |

## Discord

Uses Discord Interactions (slash commands via webhook endpoint `/api/discord`). No persistent bot gateway needed - the endpoint receives `POST` requests from Discord, verifies the Ed25519 signature with `tweetnacl`, and returns a response JSON.

When a user provides an alias that covers multiple signs, the bot returns **one line per sign** (option A - all horoscopes concatenated in a single message).

Register the `/horoscope <signe>` command once via the Discord REST API (a one-off script in `scripts/register-discord-command.ts`).

## Authentication

GitHub OAuth via NextAuth v5. Only the login specified in `ALLOWED_GITHUB_LOGIN` can sign in.

Required env vars:

```
AUTH_SECRET=              # random 32-char secret
AUTH_GITHUB_ID=           # GitHub OAuth App client ID
AUTH_GITHUB_SECRET=       # GitHub OAuth App client secret
ALLOWED_GITHUB_LOGIN=     # GitHub username allowed to sign in
REDIS_URL=                # from Vercel Storage > Serverless Redis; pull with: npx vercel env pull
DISCORD_PUBLIC_KEY=       # for Ed25519 signature verification
DISCORD_APPLICATION_ID=
DISCORD_BOT_TOKEN=        # for registering commands
```

When `REDIS_URL` is absent (local dev), `cache.ts` falls back to an in-memory `Map` on `global._localStore` that survives Next.js HMR.

## Current status (as of 2026-04-28)

The codebase is functionally complete. All checks and unit tests pass (110 tests).

### Done

- **Scraper** - 3 strategies (CSS, RSS, regex) with fallback orchestrator; strategy order in `gorafi.config.ts`; `sourceUrl` (article URL) threaded through scraper → cache → API → UI.
- **Redis cache** - weekly key (8-day TTL) + stale fallback + global alias reverse index; all reads/writes go through `src/lib/cache.ts`; in-memory fallback for local dev.
- **API routes** - `/api/horoscope/[identifier]` resolves sign slugs (single object) and aliases (array); full alias CRUD; Discord; auth.
- **Discord** - Ed25519 verification + command dispatch; `/api/discord` handles PING and `APPLICATION_COMMAND`; autocomplete includes both sign names and user aliases; multi-sign aliases expand to one line per sign.
- **Auth** - NextAuth v5 GitHub OAuth; single allowed login via `ALLOWED_GITHUB_LOGIN` env var; `jwt` callback pins `token.sub` to the stable GitHub numeric profile ID for consistent cross-browser identity.
- **Frontend** - Home grid (3 columns, 1200px wide, alias count badge per sign, copy button, source link in subtitle); sign detail page (read-only); `/aliases` page (create/edit/delete aliases, sign chips, export/import JSON with old pseudo format backward compat); session-aware nav; write errors surfaced via `--error` color notification.
- **Unit tests** - `tests/unit/`: all five scraper strategy parsing functions, orchestrator, cache (Redis + local store fallback), discord sig, signs, discord route handler (110 tests).
- **Component tests** - `tests/component/AliasManager.test.tsx` (18 tests).

### Still missing

- `scripts/register-discord-command.ts` - one-off script to register `/horoscope <signe>` via the Discord REST API. Needs `DISCORD_APPLICATION_ID` + `DISCORD_BOT_TOKEN`.
- `tests/e2e/` - Playwright e2e tests (directory exists, no files yet).
- Vercel deployment + env vars not wired up yet.

## Coding rules

### Testing and documentation (mandatory)

Every feature, change, or bug fix must be accompanied by:

1. **Tests** - unit tests for pure logic (`tests/unit/`), component tests for client components with non-trivial behaviour (`tests/component/`). If a behaviour can be tested, it must be. `make check` must pass before considering a task done.
2. **Documentation** - update `AGENTS.md` if the change introduces a new pattern, rule, or constraint (e.g. a new helper to always use, a new convention, a new env var). Update `README.md` if the change is user-visible (new feature, new command, new env var). Update relevant files in `doc/` when a third-party integration changes.

**Definition of done: code + tests + docs. Never mark a task complete if any of the three is missing.**

### Component tests (`tests/component/`)

- Use Vitest + `@testing-library/react`.
- jsdom does not implement `URL.createObjectURL` / `URL.revokeObjectURL` - stub them at module level: `Object.assign(URL, { createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() })`.
- jsdom `File.text()` is unreliable - use mock file objects: `{ text: () => Promise.resolve(content) } as File`.
- Do not test `Blob.prototype.text()` in jsdom - check `blob.type` and `blob.size` instead.
- Mock `fetch` globally in `beforeEach` with `vi.stubGlobal("fetch", vi.fn())`.

### General rules

- **No em dashes** - never use `—` (U+2014). Use a regular hyphen `-` instead.
- **TypeScript strict** - no implicit `any`, `noUncheckedIndexedAccess` enabled.
- **Code and comments in English.** UI copy can be in French since the product is French.
- **Theme values in `src/styles/theme.css`** as CSS custom properties. Never hardcode colors in components - always `var(--token)`.
- **Tailwind is installed but not used** - all styling uses inline styles + CSS custom properties. Do not add Tailwind classes.
- **No speculative abstractions.** Don't add helpers, fallbacks or features that aren't required by the current task.
- **All scraper strategy parsing functions must be exported and independently testable** (pure functions, no network calls).
- **No network calls in unit tests** - mock at the strategy boundary (`scrapeAllWithCSS`, `scrapeAllWithRSS`, `scrapeAllWithRegex`).
- **Redis reads/writes via `src/lib/cache.ts`** - never call `ioredis` directly in route handlers.
- **Client components** - any component using hooks (`useState`, `useEffect`) or event handlers must have `"use client"` as its first line.
- **Buttons inside `<Link>`** - use `e.stopPropagation()` in the button's onClick to prevent the parent link from navigating.
- **CSS hover/focus effects** - inline styles don't support `:hover`. Add a CSS class in `src/app/globals.css` instead.
- **Auth in route handlers** - use `requireUserId()` from `src/lib/auth.ts`. Pattern: `const userId = await requireUserId(); if (userId instanceof NextResponse) return userId;`
- **Scraping error handling** - wrap `scrapeAllHoroscopes()` in try/catch in every route. On failure, return what's in cache (stale or null) rather than letting the error propagate. Never return a 500 for a scraping failure.
- **Sign input matching** - use `findSignByInput()` from `src/lib/signs.ts` instead of `isValidSign()` for user-facing input. It handles accents, case, and singular/plural (e.g. "poisson" → poissons, "Bélier" → belier).
- **String normalization** - use `normalize()` from `src/lib/signs.ts` (strips accents + lowercase). Do not reimplement inline.
- **HTTP fetching in scrapers** - use `fetchPage()` from `src/lib/scraper/fetch.ts`. Do not add a local `fetchPage` in strategy files.
- **TypeScript narrowing across async callbacks** - after `if (!session?.user?.id) return`, extract `const userId = session.user.id` before any `async` callback or `Promise.all` to avoid losing the narrowed type.
- **Case-insensitive string comparison** - use `localeEquals(a, b)` from `src/lib/signs.ts`. Do not inline `localeCompare` calls.
- **Alias vs sign slug in horoscope endpoint** - `GET /api/horoscope/[identifier]` returns a **single object** for a sign slug and an **array** for an alias. Callers must handle both shapes.
- **Run `make check` before committing.**

## Commands

```bash
make install      # npm install + playwright install
make dev          # Next.js dev server in foreground (http://localhost:6677)
make start        # Next.js dev server in background (http://localhost:6677)
make stop         # Stop the background dev server
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
