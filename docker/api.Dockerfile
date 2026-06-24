# Plantilla: ajustar rutas después de crear el monorepo.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS development
COPY . .
RUN pnpm install --frozen-lockfile
CMD ["pnpm", "--filter", "api", "dev"]

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter api prisma generate
RUN pnpm --filter api build
RUN pnpm deploy --filter api --prod /prod/api

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /prod/api ./
USER app
EXPOSE 4000
CMD ["node", "dist/main.js"]
