# Redis Cloud setup

Le cache hebdomadaire des horoscopes et l'index des pseudos sont stockés dans Redis Cloud, connecté via Vercel Storage (option **Serverless Redis**).

En développement local, si `REDIS_URL` est absente, `cache.ts` bascule automatiquement sur un store en mémoire - aucune configuration Redis n'est nécessaire pour développer.

---

## 1. Créer le store

1. Aller sur [vercel.com](https://vercel.com) → ton projet → onglet **Storage**
2. Cliquer **Create Database**
3. Choisir **Redis** (Redis Cloud - Serverless Redis)
4. Donner un nom (`legoroscope-redis`), choisir une région proche
5. Cliquer **Create**

## 2. Connecter le store au projet

1. Sur la page du store → onglet **Projects**
2. Cliquer **Connect Project** → sélectionner `legoroscope`, activer l'environnement **Production**
3. Vercel injecte automatiquement `REDIS_URL` dans les variables d'environnement du projet

## 3. Récupérer les variables en local

```bash
npx vercel env pull .env.local
```

Cela écrase `.env.local` avec toutes les variables du projet Vercel, `REDIS_URL` inclus.

## Récapitulatif des variables

| Variable    | Où la trouver                                     |
| ----------- | ------------------------------------------------- |
| `REDIS_URL` | Injectée automatiquement après connexion du store |

## Schéma des clés

| Clé                              | Valeur                                              |
| -------------------------------- | --------------------------------------------------- |
| `horoscope:{year}:{week}:{sign}` | `{ text, fetchedAt, strategy, sourceUrl }` - TTL 8j |
| `horoscope:stale:{sign}`         | Dernière valeur connue, sans TTL                    |
| `user:{githubId}:pseudos:{sign}` | `["pseudo1", "pseudo2"]`                            |
| `pseudo:{lowercase}`             | `{ sign, userId }` - index global pseudo→signe      |
