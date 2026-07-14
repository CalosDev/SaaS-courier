# Pruebas locales

## Requisitos

- Node.js 22, pnpm y Docker Desktop.
- `.env` local creado desde `.env.example`.
- Puertos libres: 3000, 4000, 5432, 9000, 9001, 1025 y 8025.

## Arranque completo

```powershell
pnpm install
pnpm db:up
pnpm db:migrate:deploy
pnpm rbac:sync-permissions
$env:ALLOW_LOCAL_BOOTSTRAP='true'
$env:LOCAL_BOOTSTRAP_EMAIL='admin@courier.local'
$env:LOCAL_BOOTSTRAP_PASSWORD='<contrasena-local-de-12-o-mas-caracteres>'
pnpm bootstrap:local
pnpm pilot:integrations:check
pnpm dev
```

El bootstrap es idempotente, solo administra la organizacion `courier-local` y
requiere `APP_ENV=local`, autorizacion explicita y una base PostgreSQL local o
del Compose de desarrollo. La contrasena se recibe por entorno y no se guarda
en Git.

## Accesos

- Web: <http://localhost:3000/login>
- API live: <http://localhost:4000/health/live>
- API ready: <http://localhost:4000/health/ready>
- MinIO: <http://localhost:9001>
- Mailpit: <http://localhost:8025>
- PostgreSQL: `127.0.0.1:5432`

## Verificacion tecnica

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm pilot:backup
pnpm pilot:restore:verify
pnpm pilot:load
git diff --check
```

MinIO y Mailpit permiten comprobar localmente documentos y email. Los carriers
requieren credenciales autorizadas para una certificacion contra el sandbox del
proveedor; firma, replay, aislamiento y persistencia append-only se prueban sin
esas credenciales. SIGA permanece fuera de alcance hasta autorizacion oficial.

Las exportaciones de reportes siguen almacenadas temporalmente en PostgreSQL y
expiran segun la politica implementada. No mover ese almacenamiento sin una
decision explicita.
