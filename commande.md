
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
