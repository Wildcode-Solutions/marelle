# Marelle

Application Vue 3 dont le front et l’API sont déployables ensemble sur Cloudflare Workers. L’API
utilise directement le binding D1 `env.DB` : aucun serveur Node, PostgreSQL ou processus PM2 n’est
nécessaire.

## Architecture

| Élément | Technologie |
| --- | --- |
| Front | Vue 3, Vite, Vue Router |
| API | Cloudflare Worker TypeScript |
| Base | Cloudflare D1 |
| Authentification | Mot de passe PBKDF2 et session HttpOnly stockée dans D1 |
| Tests | Vitest et runtime local Cloudflare |

Le Worker traite `/api/*`. En production Cloudflare peut aussi servir le contenu statique de
`dist/`, avec le fallback SPA configuré dans `wrangler.jsonc`.

## Lancer le projet en local

Prérequis : Node.js 22 ou 24.

```bash
npm ci
npm run db:migrate:local
npm run dev
```

Le front est disponible sur `http://localhost:5173` et le Worker local sur
`http://127.0.0.1:8787`. Vite transmet automatiquement les requêtes `/api` au Worker.

La base D1 locale est séparée de la base distante Cloudflare. Pour repartir de zéro en local, il
suffit de supprimer les données locales Wrangler dans `.wrangler/`, puis de rejouer les migrations.

## Variables locales

Copier `.env.example` vers `.env` si nécessaire :

```dotenv
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=
```

`VITE_API_URL` reste vide quand le front et le Worker partagent le même domaine. Pour une
application Capacitor ou un front hébergé séparément, utiliser l’URL HTTPS publique du Worker.

Le binding D1 n’utilise aucun jeton API dans `.env`. Wrangler s’authentifie auprès de Cloudflare
avec `npx wrangler login`, ou avec un secret `CLOUDFLARE_API_TOKEN` fourni par la CI.

## Base D1

La configuration D1 se trouve dans `wrangler.jsonc`. Les migrations sont dans `migrations/`.

```bash
# Base locale
npm run db:migrate:local

# Base Cloudflare distante
npx wrangler login
npm run db:migrate:remote
```

La migration `0003_add_authentication.sql` ajoute les mots de passe et les sessions. Il faut
l’appliquer sur la base distante avant de déployer la version avec authentification.

## Espace administrateur

Un compte ayant le rôle `admin` voit le lien **Admin** dans la navigation et peut accéder à
`/admin`. Toutes les routes d’administration vérifient aussi le rôle côté Worker : masquer le lien
dans le front ne constitue pas la protection.

Pour attribuer le rôle au premier administrateur, remplace l’adresse e-mail puis exécute la commande
sur la base voulue :

```bash
# Développement local
npx wrangler d1 execute marelle-db --local \
  --command "UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'"

# Production Cloudflare
npx wrangler d1 execute marelle-db --remote \
  --command "UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'"
```

L’onglet **Comptes** permet ensuite de modifier les profils et de nommer d’autres administrateurs.
L’onglet **Contenu** sert de studio pédagogique : création et édition des thèmes, QCM de 2 à 6
réponses, exercices vrai/faux et réponses libres. Une question peut rester en brouillon, être
publiée ou être archivée.

## Déployer sur Cloudflare

Le chemin le plus simple déploie le front, le Worker et le binding D1 ensemble :

```bash
npx wrangler login
npm run db:migrate:remote
npm run deploy
```

`npm run deploy` vérifie les types, compile le front puis publie le Worker et ses assets. La base D1
n’est jamais supprimée par cette commande.

## Garder le front sur un VPS

Le VPS ne sert alors que les fichiers statiques : PM2 n’est pas utile.

1. Déployer le Worker et lui attribuer de préférence un sous-domaine HTTPS, par exemple
   `api.example.com`.
2. Renseigner l’origine du front dans `ALLOWED_ORIGINS` dans `wrangler.jsonc`, par exemple
   `https://marelle.example.com`, puis redéployer le Worker.
3. Créer `.env.production` sur le VPS :

```dotenv
VITE_API_URL=https://api.example.com
```

4. Compiler et servir `dist/` avec Nginx :

```bash
npm ci
npm run build
```

Nginx doit utiliser `try_files $uri $uri/ /index.html;` pour que Vue Router fonctionne au
rafraîchissement. Aucun proxy vers un port Node n’est nécessaire.

## API

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Vérifie l’accès à D1 |
| `POST` | `/api/auth/register` | Crée un compte et une session |
| `POST` | `/api/auth/login` | Ouvre une session |
| `POST` | `/api/auth/logout` | Révoque la session |
| `GET` | `/api/auth/me` | Retourne l’utilisateur connecté |
| `GET` | `/api/dashboard` | Retourne le tableau de bord authentifié |
| `GET` | `/api/admin/overview` | Retourne les indicateurs réservés aux administrateurs |
| `GET` | `/api/admin/users` | Liste paginée des comptes (`role=student`, `admin` ou `all`) |
| `PATCH` | `/api/admin/users/:id` | Modifie un profil ou son rôle |
| `GET` | `/api/admin/catalog` | Liste les matières et niveaux disponibles |
| `GET`, `POST` | `/api/admin/themes` | Liste ou crée les thèmes pédagogiques |
| `PATCH` | `/api/admin/themes/:id` | Modifie un thème |
| `GET`, `POST` | `/api/admin/questions` | Liste ou crée les questions d’un thème |
| `PATCH` | `/api/admin/questions/:id` | Modifie une question et ses réponses |
| `GET` | `/api/subjects?level=6e` | Liste les matières d’un niveau |

Les sessions utilisent un cookie `HttpOnly`, `Secure` en HTTPS et expirent après 30 jours.

## Vérifications

```bash
npm test
npm run typecheck
npm run build
npx wrangler deploy --dry-run
```

Les tests appliquent les migrations dans une base D1 locale isolée et ne modifient jamais la base
distante.

## Arborescence

```text
├── migrations/                 # Schéma et évolutions D1
├── src/                        # Application Vue
├── tests/                      # Tests du Worker avec D1 local
├── worker/                     # API Cloudflare Worker
├── worker-configuration.d.ts   # Types générés par Wrangler
├── vite.config.ts
└── wrangler.jsonc
```
