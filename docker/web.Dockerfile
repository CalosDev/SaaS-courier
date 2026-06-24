# Requiere output: "standalone" en next.config.ts.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS development
COPY . .
RUN pnpm install --frozen-lockfile
CMD ["pnpm", "--filter", "web", "dev"]

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
USER app
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
