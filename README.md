# SquadPost

Monorepo de la plateforme de communication sportive SquadPost.

## Prérequis

- Node.js 22.12 ou supérieur sur une branche LTS
- pnpm 11
- Docker et Docker Compose

## Installation locale

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:validate
pnpm db:migrate:dev
pnpm db:seed:dev
pnpm dev
```

- Interface : <http://localhost:5173>
- Santé de l'API : <http://localhost:3000/api/health>

### Comptes de développement

La commande `pnpm db:seed:dev` crée trois comptes locaux couvrant les trois rôles globaux.
Elle refuse de s'exécuter avec `NODE_ENV=production`.

| Rôle                                      | E-mail                          | Mot de passe local     |
| ----------------------------------------- | ------------------------------- | ---------------------- |
| Joueur (`PLAYER`)                         | `player@squadpost.local`        | `SquadPost-demo-2026!` |
| Responsable communication (`COM_MANAGER`) | `communication@squadpost.local` | `SquadPost-demo-2026!` |
| Administrateur global (`ADMIN`)           | `admin@squadpost.local`         | `SquadPost-demo-2026!` |

## Vérifications

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm db:validate
```

Les tests Playwright demandent l'installation préalable des navigateurs :

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

## Prototype d'affiches Barbarians v5

```bash
pnpm posters:generate
```

Les trois PNG Instagram 1080 × 1350 et les diagnostics des zones sont générés dans `tests/output/barbarians/v5/`. Les portraits PNG transparents de `tests/fixtures/players/detoures/` sont prioritaires, avec repli sur les JPG. Les références JPG et les comparatifs côte à côte sont générés dans le même dossier. Ces fichiers sont des sorties locales de contrôle visuel et ne sont pas suivis par Git.

## Docker Compose

```bash
docker compose up --build
```

L'application est alors exposée sur <http://localhost:8080>. Les données PostgreSQL et les futurs médias sont conservés dans des volumes Docker privés.

Les photos de composition sont conservées dans le volume persistant `media_data`, jamais en base64 dans PostgreSQL. En local, `MEDIA_ROOT` choisit le répertoire de stockage et `PLAYER_PHOTO_MAX_BYTES` fixe la taille maximale d'un JPG/PNG (10 Mio par défaut). L'API valide le contenu réel de l'image et conserve le fichier original sans transformation.

La documentation fonctionnelle complète se trouve dans [`docs/`](docs/README.md).
