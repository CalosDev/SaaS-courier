# Courier SaaS · Modelo A+

Monorepo de una plataforma SaaS B2B multi-tenant para digitalizar la operación de empresas courier existentes en República Dominicana.

## Stack

- Next.js + React + TypeScript
- NestJS + TypeScript
- Prisma ORM
- PostgreSQL 15+
- pnpm workspaces + Turborepo
- Docker y Docker Compose

## Documentos principales

- `docs/estado-cierre-modelo-a-plus-2026-07-12.md`
- `ingenieria_inversa_courier_modelo_a_plus_mvp_v0_2.md`
- `courier_saas_modelo_a_plus_mvp_v0_2.sql`
- `AGENTS.md`
- `docs/implementation-plan.md`
- `docs/development.md`
- `docs/docker.md`
- `docs/deployment.md`
- `docs/database.md`

## Estado actual

El alcance funcional aprobado llega hasta el Ticket 45. Durante el cierre del Modelo A+ no se agregan nuevos módulos: la prioridad es completar la línea base técnica, el hardening, los flujos E2E y la aceptación operativa.

La matriz oficial de avance, evidencia y pendientes es `docs/estado-cierre-modelo-a-plus-2026-07-12.md`.

## Comandos raiz

El repositorio usa pnpm workspaces y Turborepo desde la raíz. `apps/web` contiene el backoffice Next.js y `apps/api` contiene el monolito modular NestJS.

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

El backoffice usa mismo origen publico para autenticacion y CSRF. El navegador llama rutas relativas `/backend/*` y Next.js las reescribe internamente hacia NestJS usando `API_INTERNAL_URL`.

```bash
API_INTERNAL_URL=http://localhost:4000
NEXT_PUBLIC_API_BASE_PATH=/backend
```

Pruebas del frontend:

```bash
pnpm --filter @courier/web test
pnpm --filter @courier/web test:e2e
```

## Backend API

La aplicacion NestJS vive en `apps/api` y expone `GET /health` en el puerto 4000 por defecto.

```bash
pnpm --filter @courier/api dev
pnpm --filter @courier/api test
pnpm --filter @courier/api test:e2e
```

Las pruebas e2e del API requieren PostgreSQL activo porque inicializan Prisma durante el ciclo de vida de NestJS.

Los primeros endpoints administrativos protegidos disponibles actualmente son:

- `GET /organizations/current`
- `PATCH /organizations/current`
- `GET /organizations/current/settings`
- `PATCH /organizations/current/settings`
- `GET /organizations/current/capabilities`
- `GET /organizations/current/onboarding`
- `POST /organizations/current/onboarding/complete`
- `GET /facilities`
- `POST /facilities`
- `GET /facilities/:facilityId`
- `PATCH /facilities/:facilityId`
- `GET /customers`
- `POST /customers`
- `GET /customers/:customerId`
- `PATCH /customers/:customerId`
- `GET /customers/:customerId/addresses`
- `POST /customers/:customerId/addresses`
- `PATCH /customers/:customerId/addresses/:addressId`
- `GET /customers/:customerId/customs-profile`
- `PUT /customers/:customerId/customs-profile`
- `PATCH /customers/:customerId/customs-profile/verification`
- `GET /customer-imports`
- `POST /customer-imports`
- `GET /customer-imports/:importId`
- `POST /customer-imports/:importId/validate`
- `POST /customer-imports/:importId/commit`
- `POST /customer-imports/:importId/cancel`
- `GET /prealerts`
- `POST /prealerts`
- `GET /prealerts/:prealertId`
- `PATCH /prealerts/:prealertId`
- `POST /prealerts/:prealertId/cancel`
- `GET /packages`
- `POST /packages`
- `GET /packages/:packageId`
- `PATCH /packages/:packageId`
- `POST /packages/:packageId/cancel`
- `POST /packages/:packageId/receive`
- `GET /packages/:packageId/reception`

La identificacion aduanera de clientes se guarda en `CustomerCustomsProfile`. El listado general `GET /customers` no expone cedulas, pasaportes, RNC ni estado RUA.

La importacion inicial de clientes usa staging JSON en base de datos y requiere el flujo `create -> validate -> commit`. En este punto no hay CSV, Excel, archivos ni S3.

## Prealertas

El backoffice inicial de prealertas vive en:

```bash
/prealerts
/prealerts/new
/prealerts/:prealertId
```

La prealerta registra una compra esperada y no confirma recepcion fisica del paquete.

## Paquetes

El backoffice inicial de paquetes vive en:

```bash
/packages
/packages/new
/packages/:packageId
/packages/:packageId/receive
```

El paquete representa el registro operativo inicial del courier. La recepcion fisica registra facility, peso, dimensiones, piezas, condicion y empleado receptor, y cambia el estado a `RECEIVED_AT_ORIGIN` de forma atomica con audit y outbox. Las fotografias y ubicaciones de inventario permanecen fuera de este alcance.

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
pnpm outbox:status
```

`pnpm outbox:status` muestra un resumen agregado de entrega sin exponer payloads, metadata ni claves de idempotencia.

Para crear y revisar migraciones versionadas:

```bash
pnpm db:migrate:dev --name <nombre> --create-only
pnpm db:migrate:dev
pnpm db:migrate:status
pnpm db:generate
```
