# Commandes de développement et de déploiement

Ce document résume les commandes utiles pour préparer la base locale, mettre à jour la base D1
Cloudflare et déployer l'application Marelle.

## À retenir

- La base locale et la base D1 distante sont deux bases différentes.
- Les migrations SQL se trouvent dans `migrations/`.
- La base s'appelle `marelle-db` et le Worker y accède avec le binding `DB`.
- `npm run deploy` publie le Worker et le front compilé dans `dist/`.
- `npm run deploy` **n'applique pas** les migrations D1 : il faut les exécuter séparément.

## 1. Préparer le projet

Depuis le dossier du projet :

```bash
cd /Users/jeanlouisfeuvrier/projets/marelle
npm ci
```

Vérifier la version de Wrangler installée dans le projet :

```bash
npx wrangler --version
```

Pour les opérations distantes, vérifier la connexion à Cloudflare :

```bash
npx wrangler whoami
```

Si aucune session n'est active, se connecter une seule fois :

```bash
npx wrangler login
```

## 2. Lancer la base et l'application en local

Appliquer les migrations à la base D1 locale :

```bash
npm run db:migrate:local
```

Vérifier qu'il ne reste aucune migration locale en attente :

```bash
npx wrangler d1 migrations list marelle-db --local
```

Lancer le front et le Worker local :

```bash
npm run dev
```

Les services sont alors disponibles aux adresses suivantes :

- front Vue : `http://localhost:5173` ;
- API Worker : `http://127.0.0.1:8787`.

Dans un autre terminal, vérifier que l'API accède bien à la base locale :

```bash
curl -fsS http://127.0.0.1:8787/api/health
```

Résultat attendu :

```json
{"status":"ok","services":{"database":"ok"}}
```

Arrêter les serveurs avec `Ctrl+C`.

## 3. Créer une nouvelle migration D1

Créer un fichier de migration en utilisant un nom court et descriptif :

```bash
npx wrangler d1 migrations create marelle-db description_de_la_modification
```

Wrangler crée automatiquement le prochain fichier numéroté dans `migrations/`. Ajouter les
instructions SQL dans ce nouveau fichier, puis le tester localement :

```bash
npm run db:migrate:local
npm test
npm run typecheck
```

Ne pas modifier une ancienne migration déjà appliquée en production. Créer une nouvelle migration
pour toute correction ou évolution du schéma.

## 4. Mettre à jour la base D1 distante

Avant toute modification, afficher les migrations distantes en attente :

```bash
npx wrangler d1 migrations list marelle-db --remote
```

Appliquer les migrations à la base D1 Cloudflare :

```bash
npm run db:migrate:remote
```

Wrangler affiche les migrations concernées et demande une confirmation. Cloudflare capture aussi
une sauvegarde D1 dans le cadre de cette opération.

Vérifier ensuite qu'il ne reste aucune migration en attente :

```bash
npx wrangler d1 migrations list marelle-db --remote
```

Le résultat attendu est `No migrations to apply!`.

> Attention : l'option `--remote` agit sur la base utilisée en production. Toujours valider la
> migration en local et exécuter les tests avant cette étape.

## 5. Déployer le Worker et le front

Effectuer les vérifications avant le déploiement :

```bash
npm test
npm run build
npx wrangler deploy --dry-run
```

Si le code dépend d'une nouvelle migration, appliquer d'abord celle-ci à D1, puis déployer
l'application :

```bash
npm run db:migrate:remote
npm run deploy
```

Le script `npm run deploy` effectue les opérations suivantes :

1. vérification des types TypeScript ;
2. compilation du front Vue dans `dist/` ;
3. publication du Worker, des fichiers statiques et de la configuration `wrangler.jsonc`.

Une migration destinée à la production doit rester compatible avec le Worker encore déployé
pendant les quelques instants précédant la publication de sa nouvelle version. Pour une suppression
ou un renommage de colonne, procéder en plusieurs migrations et plusieurs déploiements.

## 6. Vérifier le déploiement

Afficher les derniers déploiements du Worker :

```bash
npx wrangler deployments list --name marelle
```

Tester l'API en production :

```bash
curl -fsS https://marelle.wildcode-solutions.com/api/health
```

Résultat attendu :

```json
{"status":"ok","services":{"database":"ok"}}
```

Consulter les logs du Worker en direct :

```bash
npx wrangler tail marelle
```

Quitter l'affichage des logs avec `Ctrl+C`.

## 7. Procédure complète pour un déploiement en production

```bash
cd /Users/jeanlouisfeuvrier/projets/marelle
npm ci
npx wrangler whoami
npm run db:migrate:local
npm test
npm run build
npx wrangler deploy --dry-run
npx wrangler d1 migrations list marelle-db --remote
npm run db:migrate:remote
npm run deploy
npx wrangler d1 migrations list marelle-db --remote
npx wrangler deployments list --name marelle
curl -fsS https://marelle.wildcode-solutions.com/api/health
```

## 8. En cas de problème

Revenir à la version précédente du Worker :

```bash
npx wrangler rollback --name marelle
```

Ce rollback concerne uniquement le code du Worker et les fichiers publiés. Il ne restaure pas la
base D1. Une erreur de migration doit être corrigée avec une nouvelle migration ou avec les outils
de restauration D1 après avoir identifié précisément le point de restauration à utiliser.

## Récapitulatif des commandes npm

| Commande | Action |
| --- | --- |
| `npm run dev` | Lance le Worker local et le front Vue |
| `npm run db:migrate:local` | Applique les migrations à la base locale |
| `npm run db:migrate:remote` | Applique les migrations à la base D1 Cloudflare |
| `npm test` | Exécute les tests automatisés |
| `npm run typecheck` | Vérifie les types du front et du Worker |
| `npm run build` | Vérifie les types et compile le front |
| `npm run deploy` | Compile puis déploie le Worker et le front |
