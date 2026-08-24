  npm install
  npm test

  npm run db:migrate:local
  npm run db:migrate:remote

  npm run deploy

  Pour vérifier ensuite :

  npx wrangler d1 migrations list marelle-db --remote
  npx wrangler deployments list
