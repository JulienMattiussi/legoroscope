# Upstash Redis setup

Le cache hebdomadaire des horoscopes et l'index des pseudos sont stockés dans Upstash Redis, connecté via Vercel Storage.

En développement local, si les variables d'environnement sont absentes, `cache.ts` bascule automatiquement sur un store en mémoire — aucune configuration Redis n'est nécessaire pour développer.

---

## 1. Créer le store

1. Aller sur [vercel.com](https://vercel.com) → ton projet → onglet **Storage**
2. Cliquer **Create Database**
3. Choisir **Serverless Redis** (Upstash)
4. Donner un nom (`legoroscope-kv`), choisir une région proche (`fra1` pour Frankfurt)
5. Cliquer **Create**

## 2. Connecter le store au projet

1. Sur la page du store → onglet **Projects**
2. Cliquer **Connect Project** → sélectionner `legoroscope`
3. Vercel injecte automatiquement `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` dans les variables d'environnement du projet

## 3. Récupérer les variables en local

```bash
npx vercel env pull .env.local
```

Cela écrase `.env.local` avec toutes les variables du projet Vercel, Redis inclus.

> Les variables sont dans l'onglet **Next.js App Router** du Quickstart Upstash — pas dans l'onglet `.env.local` qui n'affiche que `REDIS_URL` (connexion TCP, inutilisée ici).

## Récapitulatif des variables

| Variable                   | Où la trouver                                     |
| -------------------------- | ------------------------------------------------- |
| `UPSTASH_REDIS_REST_URL`   | Injectée automatiquement après connexion du store |
| `UPSTASH_REDIS_REST_TOKEN` | Injectée automatiquement après connexion du store |

## Schéma des clés

| Clé                              | Valeur                                              |
| -------------------------------- | --------------------------------------------------- |
| `horoscope:{year}:{week}:{sign}` | `{ text, fetchedAt, strategy, sourceUrl }` — TTL 8j |
| `horoscope:stale:{sign}`         | Dernière valeur connue, sans TTL                    |
| `user:{githubId}:pseudos:{sign}` | `["pseudo1", "pseudo2"]`                            |
| `pseudo:{lowercase}`             | `{ sign, userId }` — index global pseudo→signe      |
