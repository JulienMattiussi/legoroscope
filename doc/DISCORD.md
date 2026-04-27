# Discord setup

Le bot utilise les **Discord Interactions** (webhooks) — pas de gateway persistant, pas de bot connecté en permanence. Discord envoie un `POST` à l'endpoint `/api/discord` à chaque commande slash.

## 1. Créer l'application Discord

Aller sur [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**

Donner un nom (`Legoroscope`), valider.

## 2. Récupérer les identifiants

Dans **General Information** :
- Copier **Application ID** → `DISCORD_APPLICATION_ID`
- Copier **Public Key** → `DISCORD_PUBLIC_KEY`

Dans **Bot** :
- Cliquer **Reset Token** → copier le token → `DISCORD_BOT_TOKEN`

Ajouter ces trois variables dans `.env.local` (dev) ou dans les variables d'environnement Vercel (prod).

## 3. Déployer l'app (prod uniquement)

L'endpoint doit être accessible publiquement pour que Discord puisse l'appeler. En dev, il faudrait un tunnel (ngrok, etc.) — ce n'est pas nécessaire pour tester localement, uniquement pour valider la signature Discord.

En prod sur Vercel, l'URL de l'endpoint sera :
```
https://<ton-domaine>.vercel.app/api/discord
```

## 4. Configurer l'endpoint dans Discord

Dans **General Information** → **Interactions Endpoint URL** :
```
https://<ton-domaine>.vercel.app/api/discord
```

Discord envoie un PING de vérification à cette URL lors de la sauvegarde. L'app doit répondre avec `{ type: 1 }` et la signature Ed25519 doit être valide — c'est déjà géré dans `src/app/api/discord/route.ts`.

## 5. Enregistrer la commande slash

Lancer le script d'enregistrement (à créer dans `scripts/register-discord-command.ts`) :

```bash
npx tsx scripts/register-discord-command.ts
```

Ce script appelle l'API REST Discord pour enregistrer la commande `/horoscope` avec l'option `signe`. C'est une opération **one-shot** — à relancer uniquement si la commande change.

> Le script n'existe pas encore — voir la section "Still missing" dans AGENTS.md.

## 6. Ajouter le bot à un serveur

Dans **OAuth2** → **URL Generator** :
- Scopes : `applications.commands`
- Permissions : aucune (le bot ne fait que répondre aux interactions)

Ouvrir l'URL générée et sélectionner le serveur cible.

## Récapitulatif des variables

| Variable | Où la trouver |
|---|---|
| `DISCORD_APPLICATION_ID` | General Information → Application ID |
| `DISCORD_PUBLIC_KEY` | General Information → Public Key |
| `DISCORD_BOT_TOKEN` | Bot → Reset Token |
