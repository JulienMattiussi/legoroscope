# OAuth setup

## Dev

### 1. Créer l'OAuth App GitHub

Aller sur [github.com/settings/developers](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**

| Champ | Valeur |
|---|---|
| Application name | `Legoroscope (dev)` |
| Homepage URL | `http://localhost:6677` |
| Authorization callback URL | `http://localhost:6677/api/auth/callback/github` |

Cliquer **Register application**, puis générer un **Client secret**.

### 2. Générer AUTH_SECRET

```bash
openssl rand -base64 32
```

### 3. Remplir `.env.local`

```bash
cp .env.example .env.local
```

```
AUTH_SECRET=<résultat openssl>
AUTH_GITHUB_ID=<client ID>
AUTH_GITHUB_SECRET=<client secret>
```

### 4. Vérifier

```bash
make start
```

Aller sur `http://localhost:6677` → **Connexion GitHub** → l'app doit rediriger vers GitHub et revenir connecté.

---

## Prod (Vercel)

### 1. Créer l'OAuth App GitHub

Même démarche que pour le dev, avec les URLs de production :

| Champ | Valeur |
|---|---|
| Application name | `Legoroscope` |
| Homepage URL | `https://<ton-domaine>.vercel.app` |
| Authorization callback URL | `https://<ton-domaine>.vercel.app/api/auth/callback/github` |

### 2. Ajouter les variables d'environnement sur Vercel

Dans le dashboard Vercel → projet → **Settings** → **Environment Variables**, ajouter :

| Variable | Valeur |
|---|---|
| `AUTH_SECRET` | générer avec `openssl rand -base64 32` (différent du dev) |
| `AUTH_GITHUB_ID` | client ID de l'OAuth App prod |
| `AUTH_GITHUB_SECRET` | client secret de l'OAuth App prod |

> Ne jamais réutiliser le `AUTH_SECRET` de dev en prod.

### 3. Redéployer

Vercel injecte les variables au moment du build. Un redéploiement est nécessaire si les variables ont été ajoutées après le dernier déploiement.
