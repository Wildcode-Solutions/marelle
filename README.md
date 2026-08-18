# Marelle

> **Révise un peu, progresse beaucoup.**

Marelle est une application éducative mobile-first qui transforme les révisions du collège et du lycée en une expérience quotidienne, ludique et motivante.

Inspirée des mécaniques de gamification de Duolingo, elle propose des questions et de courts défis adaptés au niveau de l’élève en mathématiques, français, histoire-géographie, sciences, langues et technologie.

L’objectif est simple : **réviser un peu chaque jour plutôt que tout revoir au dernier moment.**

## Aperçu

Le socle actuel comprend :

- une application Vue 3 responsive et pensée d’abord pour le mobile ;
- des projets natifs Android et iOS générés avec Capacitor ;
- une API TypeScript exécutée sur Cloudflare Workers ;
- une base relationnelle Cloudflare D1 gérée par migrations ;
- un tableau de bord connecté à D1 avec un profil de démonstration ;
- des tests d’intégration exécutés dans le runtime Workers.

## Stack technique

| Partie | Technologie |
| --- | --- |
| Interface | Vue 3, Vue Router, TypeScript, Vite |
| Mobile | Capacitor, Android, iOS |
| API | Cloudflare Workers |
| Base de données | Cloudflare D1 / SQLite |
| Déploiement Web | Workers Static Assets |
| Tests | Vitest, Cloudflare Workers Vitest integration |

La SPA et l’API sont déployées ensemble sur Workers. Les fichiers statiques sont servis directement, tandis que les requêtes `/api/*` sont traitées par le Worker.

## Fonctionnalités prévues

### Apprentissage

- Questions et défis quotidiens
- Parcours scolaires de la 6e à la Terminale
- Révisions par matière et par chapitre
- Quiz à choix multiples et questions interactives
- Révision automatique des erreurs
- Sessions courtes adaptées au rythme de l’élève

### Progression

- Points d’expérience (XP)
- Niveaux et suivi de progression
- Séries quotidiennes 🔥
- Succès, badges et récompenses
- Statistiques détaillées

### Motivation

- Objectifs quotidiens
- Défis quotidiens et hebdomadaires
- Système de vies
- Classements entre amis

## Prérequis

- Node.js `22.12+`
- npm
- un compte Cloudflare pour créer la base distante et déployer
- Android Studio pour Android
- macOS et Xcode pour iOS

## Installation

```bash
git clone <url-du-depot>
cd Marelle
npm install
npm run cf:types
npm run db:migrate:local
```

La migration crée la base D1 locale, son schéma et les données de démonstration.

## Développement local

```bash
npm run dev
```

L’application est alors disponible sur `http://localhost:5173` et l’API sur `http://localhost:8787`.

Vite transmet automatiquement les appels `/api` au Worker local. Les données D1 locales sont conservées dans `.wrangler/state`.

### Endpoints disponibles

| Méthode | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Vérifie le Worker et la connexion D1 |
| `GET` | `/api/dashboard` | Retourne le tableau de bord du profil de démonstration |
| `GET` | `/api/subjects?level=6e` | Liste les matières et leurs chapitres pour une classe |

## Base de données

Le premier schéma D1 couvre déjà les principales entités du produit :

- niveaux scolaires, matières et chapitres ;
- questions et choix de réponses ;
- utilisateurs, rôles `student` ou `admin`, objectifs, XP, séries et vies ;
- sessions d’apprentissage et réponses ;
- suivi des notions à revoir ;
- progression quotidienne ;
- succès et relations entre amis.

Les changements de structure doivent être ajoutés sous forme de migrations versionnées dans `migrations/`.

```bash
# Créer une nouvelle migration
npx wrangler d1 migrations create marelle-db nom_de_la_migration

# Appliquer les migrations localement
npm run db:migrate:local

# Appliquer les migrations sur Cloudflare
npm run db:migrate:remote
```

## Créer la base D1 distante

La base distante n’est pas créée automatiquement pendant l’installation locale. Pour préparer Cloudflare :

```bash
npx wrangler login
npx wrangler d1 create marelle-db --location weur
```

Accepter l’ajout de la base dans `wrangler.jsonc`, ou reporter le `database_id` retourné dans le binding `DB` existant. Puis exécuter :

```bash
npm run cf:types
npm run db:migrate:remote
npm run deploy
```

## Applications mobiles

Les dossiers natifs `android/` et `ios/` sont déjà initialisés.

Pour utiliser l’API depuis une application native, copier `.env.example` vers `.env.local` et renseigner l’URL HTTPS du Worker :

```dotenv
VITE_API_URL=https://marelle.<sous-domaine>.workers.dev
```

Construire ensuite l’application Web et synchroniser les projets natifs :

```bash
npm run mobile:sync
```

Ouvrir la plateforme souhaitée :

```bash
npm run android:open
npm run ios:open
```

## Vérifications

```bash
# Contrôle TypeScript et build de production
npm run build

# Tests Worker et D1
npm test

# Audit des dépendances de production
npm audit --omit=dev
```

## Structure du projet

```text
Marelle/
├── android/                 # Projet natif Android
├── ios/                     # Projet natif iOS
├── migrations/              # Migrations Cloudflare D1
├── src/                     # Application Vue
│   ├── components/
│   ├── router/
│   ├── services/
│   ├── styles/
│   ├── types/
│   └── views/
├── tests/                   # Tests d’intégration Worker/D1
├── worker/                  # API Cloudflare Worker
├── capacitor.config.ts
├── vite.config.ts
└── wrangler.jsonc
```

## Feuille de route

- [x] Créer le socle Vue, Capacitor, Workers et D1
- [x] Définir le premier schéma de données
- [x] Connecter un tableau de bord mobile à D1
- [ ] Ajouter l’authentification et les vrais profils élèves
- [ ] Créer l’interface d’administration et protéger ses routes
- [ ] Développer le moteur de quiz
- [ ] Enregistrer les réponses, XP et séries quotidiennes
- [ ] Ajouter la révision intelligente des erreurs
- [ ] Compléter le tableau de bord de progression
- [ ] Ajouter les succès, badges et défis
- [ ] Développer les fonctionnalités sociales

## Philosophie pédagogique

**5 à 10 minutes par jour peuvent faire la différence.**

Marelle ne cherche pas à remplacer les cours ou les enseignants. L’application complète l’apprentissage en rendant la révision plus accessible, progressive et engageante.

Pas de longues fiches à apprendre d’un seul coup : quelques questions aujourd’hui, quelques questions demain, et une progression visible tout au long de l’année.

---

**Marelle — révise un peu, progresse beaucoup.**
