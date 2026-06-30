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

## Backend API

La aplicacion NestJS vive en `apps/api` y expone `GET /health` en el puerto 4000 por defecto.

```bash
pnpm --filter @courier/api dev
pnpm --filter @courier/api test
pnpm --filter @courier/api test:e2e
```

Las pruebas e2e del API requieren PostgreSQL activo porque inicializan Prisma durante el ciclo de vida de NestJS.

## Autenticacion HTTP

El backend expone autenticacion con cookies HttpOnly y proteccion CSRF. En desarrollo local:

```bash
CORS_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
```

El frontend debe pedir primero `GET /auth/csrf`, enviar el token devuelto en `X-CSRF-Token` y usar `credentials: include` en cada `fetch` autenticado.

El throttling actual usa almacenamiento en memoria por proceso. En produccion con multiples instancias se necesitara almacenamiento compartido.

## Base de datos local

PostgreSQL se ejecuta en Docker para desarrollo local. Copia los valores de ejemplo antes de iniciar el servicio:

```bash
cp .env.example .env
pnpm db:up
pnpm db:status
pnpm db:logs
pnpm db:down
```

`pnpm db:down` detiene los contenedores sin eliminar el volumen `postgres_data`.

## Prisma

Prisma vive dentro de `apps/api` y usa la variable `DATABASE_URL` del archivo `.env` de la raiz. El cliente generado no se versiona y se puede regenerar cuando sea necesario.

```bash
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm db:check
pnpm rbac:sync-permissions
```

Para crear y revisar migraciones versionadas:

```bash
pnpm db:migrate:dev --name <nombre> --create-only
pnpm db:migrate:dev
pnpm db:migrate:status
pnpm db:generate
```
