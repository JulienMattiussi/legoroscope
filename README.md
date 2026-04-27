# Légoroscope

Horoscope hebdomadaire du [Gorafi](https://www.legorafi.fr/category/horoscope/), servi via une API Next.js, affiché dans un bot Discord et une interface web avec connexion GitHub OAuth.

## Fonctionnalités

- **Scraping** — 3 stratégies (CSS, RSS, regex) avec fallback automatique ; cache hebdomadaire dans Vercel KV ; fallback sur la dernière valeur connue si tout échoue.
- **API REST** — un endpoint par signe, un endpoint global pour tous les signes, résolution de pseudos (un pseudo mappé à un signe → retourne l'horoscope du signe).
- **Bot Discord** — commande slash `/horoscope` via webhook Interactions (sans gateway persistant) ; jusqu'à 5 signes ou pseudos en une seule commande ; autocomplete ; fonctionne en DM et hors serveur (User Install).
- **Web** — grille des 13 signes avec compte de pseudos, page de détail, page `/pseudos` alphabétique avec export/import JSON, connexion GitHub OAuth.

## Stack

- **Next.js 15** — App Router, TypeScript strict
- **Vercel KV** (Upstash Redis) — cache hebdomadaire + index global pseudo→signe
- **NextAuth v5** — GitHub OAuth (accès restreint à un seul compte)
- **cheerio** — parsing HTML pour la stratégie CSS
- **tweetnacl** — vérification de signature Ed25519 pour Discord
- **Vitest** + `@testing-library/react` — tests unitaires et composants (62 tests)
- **Playwright** — tests e2e

## Démarrage rapide

```bash
# Prérequis : Node.js 20+, npm

cp .env.example .env.local
# Remplir les variables d'environnement (voir ci-dessous)

make install   # npm install + playwright install
make dev       # http://localhost:6677
```

## Variables d'environnement

| Variable                   | Description                                        |
| -------------------------- | -------------------------------------------------- |
| `AUTH_SECRET`              | Secret aléatoire 32 caractères (NextAuth)          |
| `AUTH_GITHUB_ID`           | Client ID de l'OAuth App GitHub                    |
| `AUTH_GITHUB_SECRET`       | Client Secret de l'OAuth App GitHub                |
| `ALLOWED_GITHUB_LOGIN`     | Login GitHub autorisé à se connecter               |
| `UPSTASH_REDIS_REST_URL`   | URL REST Upstash Redis (via Vercel Storage)        |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST Upstash Redis                           |
| `DISCORD_PUBLIC_KEY`       | Clé publique Ed25519 de l'application Discord      |
| `DISCORD_APPLICATION_ID`   | ID de l'application Discord                        |
| `DISCORD_BOT_TOKEN`        | Token bot Discord (pour enregistrer les commandes) |

En développement local, les variables KV peuvent être omises — un store en mémoire (`global._localStore`) est utilisé automatiquement.

## API

| Route                         | Méthode | Description                                             |
| ----------------------------- | ------- | ------------------------------------------------------- |
| `/api/horoscope/[identifier]` | GET     | Horoscope d'un signe (slug) ou d'un pseudo              |
| `/api/horoscopes`             | GET     | Les 13 signes d'un coup                                 |
| `/api/user/pseudos/[sign]`    | GET     | Pseudos associés à un signe (session requise)           |
| `/api/user/pseudos/[sign]`    | POST    | Ajouter un pseudo à un signe (déplace si déjà ailleurs) |
| `/api/user/pseudos/[sign]`    | DELETE  | Supprimer un pseudo d'un signe                          |
| `/api/user/pseudos`           | GET     | Tous les pseudos, triés alphabétiquement                |
| `/api/discord`                | POST    | Webhook Discord Interactions                            |

## Signes supportés

`belier`, `taureau`, `gemeaux`, `cancer`, `lion`, `vierge`, `balance`, `scorpion`, `sagittaire`, `capricorne`, `verseau`, `poissons`, `furet`

Le Furet est le 13e signe bonus du Gorafi — présent occasionnellement.

## Commandes

```bash
make install      # npm install + playwright install
make dev          # Next.js dev server en foreground (http://localhost:6677)
make start        # Next.js dev server en arrière-plan
make stop         # Arrêter le serveur en arrière-plan
make build        # Build de production
make test         # unit + e2e
make test-unit    # vitest run
make test-watch   # vitest watch
make test-e2e     # playwright test
make typecheck    # tsc --noEmit
make lint         # eslint
make format       # prettier --write
make check             # format-check + lint + typecheck + test-unit
make clean             # rm -rf .next dist
make discord-register  # Enregistrer la commande slash Discord (une seule fois)
```

## Structure du projet

```
src/
├── app/
│   ├── page.tsx                         # Home — grille 13 signes
│   ├── [sign]/page.tsx                  # Page signe + gestionnaire de pseudos
│   ├── pseudos/page.tsx                 # Grille alphabétique de tous les pseudos
│   └── api/
│       ├── horoscope/[sign]/route.ts    # GET → par signe ou pseudo
│       ├── horoscopes/route.ts          # GET → 13 signes d'un coup
│       ├── discord/route.ts             # POST → Discord Interactions
│       ├── user/pseudos/[sign]/route.ts # GET/POST/DELETE → pseudos par signe
│       ├── user/pseudos/route.ts        # GET → tous les pseudos
│       └── auth/[...nextauth]/route.ts
├── lib/
│   ├── scraper/
│   │   ├── index.ts        # Orchestrateur avec fallback entre stratégies
│   │   ├── css.ts          # Stratégie 1 : sélecteurs CSS cheerio
│   │   ├── rss.ts          # Stratégie 2 : flux RSS/Atom
│   │   └── regex.ts        # Stratégie 3 : regex sur HTML brut
│   ├── cache.ts            # Helpers Vercel KV (schéma de clés, TTL, stale fallback, index pseudos)
│   ├── discord.ts          # Vérification signature Ed25519 + dispatch commandes
│   ├── auth.ts             # Config NextAuth (GitHub provider, ALLOWED_GITHUB_LOGIN)
│   ├── gorafi.config.ts    # URLs, sélecteurs et ordre des stratégies
│   └── signs.ts            # Tableau SIGNS + helpers slugs
├── components/
│   ├── HoroscopeCard.tsx   # Carte signe : lien vers détail + bouton copie
│   ├── CopyButton.tsx      # Client component — copie presse-papiers avec feedback 2s
│   ├── PseudoManager.tsx   # Client component — ajout/suppression pseudos
│   └── PseudoGrid.tsx      # Client component — grille alphabétique avec corbeille + export/import JSON
└── styles/
    └── theme.css           # CSS custom properties — toutes les couleurs ici
tests/
├── unit/          # Vitest — logique pure (scraper, cache, signature Discord)
├── component/     # Vitest + Testing Library
└── e2e/           # Playwright (à venir)
```

## Licence

MIT — voir [LICENSE](LICENSE).
