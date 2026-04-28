# Discord setup

Le bot utilise les **Discord Interactions** (webhooks) — pas de gateway persistant. Discord envoie un `POST` à l'endpoint `/api/discord` à chaque commande slash.

La commande est enregistrée en mode **User Install** : une fois autorisée sur ton compte Discord, elle est disponible partout — serveurs, DMs, conversations de groupe — même sans que le bot soit membre du serveur.

---

## 1. Créer l'application Discord

1. Aller sur [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Donner un nom (`Legoroscope`), valider

## 2. Récupérer les identifiants

Dans **General Information** :

- Copier **Application ID** → `DISCORD_APPLICATION_ID`
- Copier **Public Key** → `DISCORD_PUBLIC_KEY`

Dans **Bot** :

- Cliquer **Reset Token** → copier le token → `DISCORD_BOT_TOKEN`

Ajouter ces trois variables dans `.env.local` (dev) ou dans les variables d'environnement Vercel (prod).

## 3. Activer "User Install"

Dans **Installation** :

1. Dans **Installation Contexts**, cocher **User Install** (en plus de Guild Install si tu veux que la commande soit aussi disponible dans les serveurs)
2. Dans **Default Install Settings → User Install**, ajouter le scope `applications.commands`
3. Cliquer **Save Changes**

> Sans cette étape, la commande ne sera disponible que dans les serveurs où le bot est invité.

## 4. Déployer l'app

L'endpoint `/api/discord` doit être accessible publiquement pour que Discord puisse l'appeler.

En prod sur Vercel, l'URL sera :

```
https://<ton-domaine>.vercel.app/api/discord
```

En dev local, il faut un tunnel (ex : `ngrok http 6677`) — uniquement nécessaire pour valider la configuration, pas pour le développement quotidien.

## 5. Configurer l'endpoint dans Discord

Dans **General Information** → **Interactions Endpoint URL** :

```
https://<ton-domaine>.vercel.app/api/discord
```

Discord envoie un PING de vérification à la sauvegarde. L'app doit répondre `{ type: 1 }` avec une signature Ed25519 valide — c'est géré dans `src/app/api/discord/route.ts`.

## 6. Enregistrer la commande slash

Avec les variables d'environnement remplies dans `.env.local`, lancer :

```bash
make discord-register
```

Ce script appelle l'API REST Discord pour déclarer la commande `/horoscope` globalement. C'est une opération **one-shot** — à relancer uniquement si la définition de la commande change.

La commande accepte :

- un slug de signe : `/horoscope cancer`
- un pseudo : `/horoscope michel` (résolu vers le signe associé dans le KV)

## 7. Installer la commande sur ton compte Discord

1. Dans **Installation** → copier le lien d'installation **User Install**
2. Ouvrir ce lien dans un navigateur → **Autoriser**
3. La commande `/horoscope` est maintenant disponible dans **toutes tes conversations Discord**

Pour l'installer aussi dans un serveur (pour que d'autres membres puissent l'utiliser) :

1. Dans **OAuth2** → **URL Generator**
2. Scopes : `applications.commands`
3. Ouvrir l'URL générée → sélectionner le serveur cible

## Récapitulatif des variables

| Variable                 | Où la trouver                        |
| ------------------------ | ------------------------------------ |
| `DISCORD_APPLICATION_ID` | General Information → Application ID |
| `DISCORD_PUBLIC_KEY`     | General Information → Public Key     |
| `DISCORD_BOT_TOKEN`      | Bot → Reset Token                    |
