# Migrations

Les migrations Prisma sont versionnées dans ce dossier et relues avant application.

- Développement : `pnpm db:migrate:dev`
- Déploiement : `pnpm db:migrate:deploy`
- Validation du schéma : `pnpm db:validate`

Ne pas utiliser `prisma db push` comme substitut aux migrations versionnées. Les politiques PostgreSQL avancées, notamment l'isolation multiclub, pourront être ajoutées dans le SQL des migrations lorsque le modèle métier sera implémenté.
