# Déploiement Vercel

## Prérequis

Avoir configuré les services dans l'ordre suivant (voir les docs dédiées) :

1. [GitHub OAuth](OAUTH.md) - pour l'authentification
2. [Redis Cloud](REDIS.md) - pour le cache
3. [Discord](DISCORD.md) - pour le bot slash command

## 1. Créer le projet sur Vercel

1. Aller sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importer le dépôt GitHub `legoroscope`
3. Laisser les paramètres par défaut (Next.js détecté automatiquement)
4. Cliquer **Deploy** - le premier déploiement échouera si les variables d'environnement ne sont pas encore renseignées, c'est normal

## 2. Ajouter les variables d'environnement

Dans le dashboard Vercel → projet → **Settings** → **Environment Variables** :

| Variable                 | Valeur                                       |
| ------------------------ | -------------------------------------------- |
| `AUTH_SECRET`            | `openssl rand -base64 32` (différent du dev) |
| `AUTH_GITHUB_ID`         | Client ID de l'OAuth App GitHub **prod**     |
| `AUTH_GITHUB_SECRET`     | Client Secret de l'OAuth App GitHub **prod** |
| `ALLOWED_GITHUB_LOGIN`   | Ton login GitHub                             |
| `REDIS_URL`              | Injectée automatiquement via Vercel Storage  |
| `DISCORD_PUBLIC_KEY`     | Clé publique de l'application Discord        |
| `DISCORD_APPLICATION_ID` | ID de l'application Discord                  |
| `DISCORD_BOT_TOKEN`      | Token bot Discord                            |

`REDIS_URL` est injectée automatiquement quand le store est connecté au projet (voir [REDIS.md](REDIS.md)) - pas besoin de la copier à la main.

## 3. Redéployer

Après avoir ajouté les variables :

- Soit pousser un commit sur `main`
- Soit dans l'onglet **Deployments** → cliquer les `…` du dernier déploiement → **Redeploy**

## 4. Configurer l'endpoint Discord

Une fois l'URL de production connue (`https://<ton-domaine>.vercel.app`), aller dans le [Discord Developer Portal](https://discord.com/developers/applications) → **General Information** → **Interactions Endpoint URL** :

```
https://<ton-domaine>.vercel.app/api/discord
```

Voir [DISCORD.md](DISCORD.md) pour la suite.

## Déploiements suivants

Chaque `git push` sur `main` déclenche un déploiement automatique. Aucune action manuelle requise.

## Variables locales

Pour récupérer toutes les variables de prod en local :

```bash
npx vercel env pull .env.local
```
