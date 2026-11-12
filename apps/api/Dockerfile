FROM node:22-alpine AS build

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @squadpost/api...

COPY tsconfig.base.json ./
COPY prisma.config.ts ./
COPY prisma prisma
COPY apps/api apps/api
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm db:generate
RUN pnpm --filter @squadpost/api build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/dist ./apps/api/dist

RUN mkdir -p /data/media && chown node:node /data/media

USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
