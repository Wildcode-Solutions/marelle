  Pour le déployer toi-même plus tard :

  cd /Users/jeanlouisfeuvrier/projets/marelle

  # Première connexion uniquement
  npx wrangler login

  # Vérifications
  npm test
  npm run build
  npx wrangler deploy --dry-run

  # Déploiement réel
  npm run deploy

  Le script npm run deploy, défini dans package.json, compile le front puis publie ensemble :

  - le code du Worker ;
  - les fichiers statiques de dist/ ;
  - la configuration de wrangler.jsonc:1.

  Après le déploiement, vérifie :

  npx wrangler deployments list --name marelle
  curl https://marelle.wildcode-solutions.com/api/health

  Pour consulter les erreurs en direct :

  npx wrangler tail marelle

  En cas de problème, retour à la version précédente :

  npx wrangler rollback --name marelle

  Attention : un rollback du Worker ne restaure pas la base D1. Si une évolution contient une migration, utilise cet
  ordre :

  npm test
  npm run db:migrate:remote
  npm run deploy

  Cloudflare crée une nouvel




Depuis le dossier du projet :

  cd /Users/jeanlouisfeuvrier/projets/marelle

  1. Vérifier les migrations en attente :

  npx wrangler d1 migrations list marelle-db --remote

  2. Les appliquer :

  npm run db:migrate:remote

  Ce raccourci est défini dans package.json:17 et exécute :

  wrangler d1 migrations apply marelle-db --remote

  3. Vérifier qu’il ne reste rien :

  npx wrangler d1 migrations list marelle-db --remote

  Le résultat attendu est :

  No migrations to apply!

  4. Tester l’application :

  curl https://marelle.wildcode-solutions.com/api/health

  Résultat attendu :

  {"status":"ok","services":{"database":"ok"}}

  Pour une future modification de base :

  npx wrangler d1 migrations create marelle-db description_de_la_modification
  npm run db:migrate:local
  npm test
  npm run db:migrate:remote
  npm run deploy





  Vérifie d’abord l’authentification Cloudflare si nécessaire :

  npx wrangler whoami

  Si tu n’es pas connecté :

  npx wrangler login

  Puis applique les migrations distantes :

  npm run db:migrate:remote



  npm install
  npm test

  npm run db:migrate:local
  npm run db:migrate:remote

  npm run deploy

  Pour vérifier ensuite :

  npx wrangler d1 migrations list marelle-db --remote
  npx wrangler deployments list
