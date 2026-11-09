FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @squadpost/web...

COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN pnpm --filter @squadpost/web build

FROM caddy:2.10-alpine

COPY infrastructure/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /workspace/apps/web/dist /srv
