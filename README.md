# Legoroscope

Horoscope hebdomadaire du [Gorafi](https://www.legorafi.fr/category/horoscope/), servi via une API Next.js, affiché dans un bot Discord et une interface web avec connexion GitHub OAuth.

## Fonctionnalités

- **Scraping** - 3 stratégies (CSS, RSS, regex) avec fallback automatique ; cache hebdomadaire dans Redis ; fallback sur la dernière valeur connue si tout échoue.
- **API REST** - un endpoint par signe, un endpoint global pour tous les signes, résolution d'alias (un alias mappé à un ou plusieurs signes → retourne les horoscopes correspondants).
- **Bot Discord** - commande slash `/horoscope` via webhook Interactions (sans gateway persistant) ; jusqu'à 5 signes ou alias en une seule commande ; si un alias couvre plusieurs signes, tous sont affichés ; autocomplete ; fonctionne en DM et hors serveur (User Install).
- **Web** - grille des 13 signes avec compteur d'alias par signe, page de détail, page `/aliases` pour créer et gérer les alias (export/import JSON), connexion GitHub OAuth.

## Stack

- **Next.js 15** - App Router, TypeScript strict
- **Redis Cloud** (`ioredis`) - cache hebdomadaire (TTL 8 jours) + index global alias→signes
- **NextAuth v5** - GitHub OAuth (accès restreint à un seul compte)
- **cheerio** - parsing HTML pour la stratégie CSS
- **tweetnacl** - vérification de signature Ed25519 pour Discord
- **Vitest** + `@testing-library/react` - tests unitaires et composants (110 tests)
- **Playwright** - tests e2e

## Démarrage rapide

```bash
# Prérequis : Node.js 20+, npm

cp .env.example .env.local
# Remplir les variables d'environnement (voir ci-dessous)

make install   # npm install + playwright install
make dev       # http://localhost:6677
```

## Variables d'environnement

| Variable                 | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `AUTH_SECRET`            | Secret aléatoire 32 caractères (NextAuth)                |
| `AUTH_GITHUB_ID`         | Client ID de l'OAuth App GitHub                          |
| `AUTH_GITHUB_SECRET`     | Client Secret de l'OAuth App GitHub                      |
| `ALLOWED_GITHUB_LOGIN`   | Login GitHub autorisé à se connecter                     |
| `REDIS_URL`              | Injecté automatiquement via Vercel Storage (Redis Cloud) |
| `DISCORD_PUBLIC_KEY`     | Clé publique Ed25519 de l'application Discord            |
| `DISCORD_APPLICATION_ID` | ID de l'application Discord                              |
| `DISCORD_BOT_TOKEN`      | Token bot Discord (pour enregistrer les commandes)       |

En développement local, `REDIS_URL` peut être omis - un store en mémoire (`global._localStore`) est utilisé automatiquement.

## Alias

Un alias est un nom (pseudo joueur, surnom…) associé à **un ou plusieurs signes**. Créez-les sur `/aliases`.

- Dans Discord : tapez un alias dans la commande `/horoscope` → l'horoscope de chaque signe couvert s'affiche.
- Via l'API : `GET /api/horoscope/mon-alias` retourne un tableau de horoscopes.
- Import : le fichier JSON accepte le nouveau format `[{alias, signs:[…]}]` **ou** l'ancien format pseudo `[{pseudo, sign}]` (les entrées de même nom sont fusionnées).

## API

| Route                         | Méthode | Description                                                               |
| ----------------------------- | ------- | ------------------------------------------------------------------------- |
| `/api/horoscope/[identifier]` | GET     | Signe (slug) → objet horoscope ; alias → tableau `[{sign, …horoscope}]`   |
| `/api/horoscopes`             | GET     | Les 13 signes d'un coup                                                   |
| `/api/user/aliases`           | GET     | Tous les alias de l'utilisateur, triés alphabétiquement (session requise) |
| `/api/user/aliases`           | POST    | Créer un alias `{alias, signs}` ou importer en masse `{entries:[…]}`      |
| `/api/user/aliases/[alias]`   | PUT     | Remplacer les signes d'un alias `{signs:[…]}`                             |
| `/api/user/aliases/[alias]`   | DELETE  | Supprimer un alias                                                        |
| `/api/discord`                | POST    | Webhook Discord Interactions                                              |

## Signes supportés

`belier`, `taureau`, `gemeaux`, `cancer`, `lion`, `vierge`, `balance`, `scorpion`, `sagittaire`, `capricorne`, `verseau`, `poissons`, `furet`

Le Furet est le 13e signe bonus du Gorafi - présent occasionnellement.

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
│   ├── page.tsx                          # Home - grille 13 signes avec compteur d'alias
│   ├── [sign]/page.tsx                   # Page signe (lecture seule)
│   ├── aliases/page.tsx                  # Gestionnaire d'alias
│   └── api/
│       ├── horoscope/[sign]/route.ts     # GET → par signe ou alias
│       ├── horoscopes/route.ts           # GET → 13 signes d'un coup
│       ├── discord/route.ts              # POST → Discord Interactions
│       ├── user/aliases/route.ts         # GET/POST → liste et création d'alias
│       ├── user/aliases/[alias]/route.ts # PUT/DELETE → mise à jour et suppression
│       └── auth/[...nextauth]/route.ts
├── lib/
│   ├── scraper/
│   │   ├── index.ts        # Orchestrateur avec fallback entre stratégies
│   │   ├── css.ts          # Stratégie 1 : sélecteurs CSS cheerio
│   │   ├── rss.ts          # Stratégie 2 : flux RSS/Atom
│   │   └── regex.ts        # Stratégie 3 : regex sur HTML brut
│   ├── cache.ts            # Helpers Redis (schéma de clés, TTL, stale fallback, index alias)
│   ├── discord.ts          # Vérification signature Ed25519 + dispatch commandes
│   ├── auth.ts             # Config NextAuth (GitHub provider, ALLOWED_GITHUB_LOGIN)
│   ├── gorafi.config.ts    # URLs, sélecteurs et ordre des stratégies
│   └── signs.ts            # Tableau SIGNS + helpers slugs
├── components/
│   ├── HoroscopeCard.tsx   # Carte signe : lien vers détail + bouton copie
│   ├── CopyButton.tsx      # Client component - copie presse-papiers avec feedback 2s
│   └── AliasManager.tsx    # Client component - CRUD alias complet (chips, export/import JSON)
└── styles/
    └── theme.css           # CSS custom properties - toutes les couleurs ici
tests/
├── unit/          # Vitest - logique pure (scraper, cache, signature Discord)
├── component/     # Vitest + Testing Library
└── e2e/           # Playwright (à venir)
```

## Licence

MIT - voir [LICENSE](LICENSE).
