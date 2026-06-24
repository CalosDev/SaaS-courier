# Courier SaaS · Modelo A+ v0.2

Paquete de documentación para iniciar el desarrollo de una plataforma SaaS multi-tenant destinada a empresas de courier en República Dominicana.

## Stack

- Next.js + React + TypeScript
- NestJS + TypeScript
- Prisma ORM
- PostgreSQL 15+
- pnpm workspaces + Turborepo
- Docker y Docker Compose

## Documentos principales

- `ingenieria_inversa_courier_modelo_a_plus_mvp_v0_2.md`
- `courier_saas_modelo_a_plus_mvp_v0_2.sql`
- `AGENTS.md`
- `docs/implementation-plan.md`
- `docs/development.md`
- `docs/docker.md`
- `docs/deployment.md`
- `docs/database.md`

## Inicio recomendado

1. Crear el monorepo.
2. Copiar `AGENTS.md` y la carpeta `docs/` al repositorio.
3. Levantar PostgreSQL con `compose.dev.yml`.
4. Implementar `/health` en NestJS.
5. Conectar una página Next.js al healthcheck.
6. Continuar por las fases del plan de implementación.

Esta carpeta contiene documentación y plantillas; no es todavía la aplicación ejecutable.

## Comandos raiz

El repositorio usa pnpm workspaces y Turborepo desde la raiz. Por ahora las carpetas `apps/` y `packages/` solo reservan la estructura del monorepo.

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

## Frontend web

La aplicacion Next.js vive en `apps/web` y se ejecuta desde el workspace con pnpm.

```bash
pnpm --filter @courier/web dev
```
