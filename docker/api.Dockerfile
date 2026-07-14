# Plantilla: ajustar rutas después de crear el monorepo.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS development
COPY . .
RUN pnpm install --frozen-lockfile
CMD ["pnpm", "--filter", "@courier/api", "dev"]

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @courier/api prisma:generate
RUN pnpm --filter @courier/api build
RUN pnpm --filter @courier/api deploy --legacy --prod /prod/api
RUN rm -f /prod/api/dist/scripts/bootstrap-local.js

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN npm uninstall --global npm
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /prod/api ./
USER app
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
