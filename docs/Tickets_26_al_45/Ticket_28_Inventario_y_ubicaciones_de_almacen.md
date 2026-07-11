# Ticket 28 — Inventario y ubicaciones de almacen

## Rama y commit

```powershell
git switch main
git switch -c feat/warehouse-inventory
```

Commit previsto: `feat(api): add warehouse inventory locations`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- WarehouseLocation
- PackageInventoryPosition
- InventoryMovement

## Enums nuevos

- WarehouseLocationType: RECEIVING, SHELF, RACK, BIN, STAGING, HOLD, DISPATCH
- InventoryMovementType: PUTAWAY, MOVE, HOLD, RELEASE, REMOVE

## Cambios en enums existentes

_Ninguno._

## Permisos

- inventory.read
- inventory.manage

## Endpoints

- GET /inventory/locations
- POST /inventory/locations
- PATCH /inventory/locations/:locationId
- GET /inventory/packages
- POST /inventory/packages/:packageId/move
- GET /inventory/packages/:packageId/movements

## Rutas web

- /inventory/locations
- /inventory/packages

## Reglas obligatorias

- Location pertenece a Facility del mismo tenant.
- Codigo de ubicacion unico por facility.
- Una sola posicion actual por paquete.
- InventoryMovement es append-only.
- Solo paquetes recibidos pueden colocarse o moverse.
- Movimiento, posicion, audit y outbox son atomicos.

## Auditoria

- inventory.location.created
- inventory.location.updated
- inventory.package.moved

## Outbox

- inventory.package.moved

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- transferencias entre facilities
- escaneo masivo
- embarques

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 28: Inventario y ubicaciones de almacen.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: WarehouseLocation, PackageInventoryPosition, InventoryMovement
- Permisos: inventory.read, inventory.manage
- Endpoints: GET /inventory/locations, POST /inventory/locations, PATCH /inventory/locations/:locationId, GET /inventory/packages, POST /inventory/packages/:packageId/move, GET /inventory/packages/:packageId/movements
- Rutas: /inventory/locations, /inventory/packages

Reglas obligatorias:
- Location pertenece a Facility del mismo tenant.
- Codigo de ubicacion unico por facility.
- Una sola posicion actual por paquete.
- InventoryMovement es append-only.
- Solo paquetes recibidos pueden colocarse o moverse.
- Movimiento, posicion, audit y outbox son atomicos.

Fuera del alcance:
- transferencias entre facilities
- escaneo masivo
- embarques

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 28. Implementa unicamente Inventario y ubicaciones de almacen.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: transferencias entre facilities, escaneo masivo, embarques.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 28 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: transferencias entre facilities, escaneo masivo, embarques.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add warehouse inventory locations"
git status
```
