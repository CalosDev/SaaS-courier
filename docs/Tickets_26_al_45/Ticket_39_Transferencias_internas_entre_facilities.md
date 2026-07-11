# Ticket 39 — Transferencias internas entre facilities

## Rama y commit

```powershell
git switch main
git switch -c feat/facility-transfers
```

Commit previsto: `feat(api): add facility transfers`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- FacilityTransfer
- FacilityTransferItem
- FacilityTransferEvent

## Enums nuevos

- FacilityTransferStatus: DRAFT, DISPATCHED, IN_TRANSIT, RECEIVED, CANCELLED

## Cambios en enums existentes

_Ninguno._

## Permisos

- transfers.read
- transfers.manage

## Endpoints

- GET /facility-transfers
- POST /facility-transfers
- GET /facility-transfers/:transferId
- PUT /facility-transfers/:transferId/items
- POST /facility-transfers/:transferId/dispatch
- POST /facility-transfers/:transferId/receive
- POST /facility-transfers/:transferId/cancel

## Rutas web

- /transfers
- /transfers/new
- /transfers/[transferId]

## Reglas obligatorias

- Origen y destino distintos del mismo tenant.
- Paquetes en origen y sin hold.
- DISPATCHED congela items y mueve a transito.
- RECEIVED crea posiciones en destino y registra diferencias.
- No registrar vehiculos ni rutas.

## Auditoria

- facility_transfer.created
- facility_transfer.items.replaced
- facility_transfer.dispatched
- facility_transfer.received
- facility_transfer.cancelled

## Outbox

- facility_transfer.dispatched
- facility_transfer.received

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- vehiculos
- GPS
- rutas
- delivery

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 39: Transferencias internas entre facilities.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: FacilityTransfer, FacilityTransferItem, FacilityTransferEvent
- Permisos: transfers.read, transfers.manage
- Endpoints: GET /facility-transfers, POST /facility-transfers, GET /facility-transfers/:transferId, PUT /facility-transfers/:transferId/items, POST /facility-transfers/:transferId/dispatch, POST /facility-transfers/:transferId/receive, POST /facility-transfers/:transferId/cancel
- Rutas: /transfers, /transfers/new, /transfers/[transferId]

Reglas obligatorias:
- Origen y destino distintos del mismo tenant.
- Paquetes en origen y sin hold.
- DISPATCHED congela items y mueve a transito.
- RECEIVED crea posiciones en destino y registra diferencias.
- No registrar vehiculos ni rutas.

Fuera del alcance:
- vehiculos
- GPS
- rutas
- delivery

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 39. Implementa unicamente Transferencias internas entre facilities.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: vehiculos, GPS, rutas, delivery.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 39 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: vehiculos, GPS, rutas, delivery.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add facility transfers"
git status
```
