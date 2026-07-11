# Ticket 35 — Consolidaciones y guias HAWB MAWB

## Rama y commit

```powershell
git switch main
git switch -c feat/airwaybills-consolidation
```

Commit previsto: `feat(api): add airwaybills and consolidations`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- HouseShipment
- HouseShipmentPackage

## Enums nuevos

- HouseShipmentStatus: DRAFT, CLOSED, CANCELLED

## Cambios en enums existentes

_Ninguno._

## Permisos

- shipments.read
- shipments.manage

## Endpoints

- GET /master-shipments/:shipmentId/house-shipments
- POST /master-shipments/:shipmentId/house-shipments
- GET /house-shipments/:houseShipmentId
- PATCH /house-shipments/:houseShipmentId
- PUT /house-shipments/:houseShipmentId/packages
- POST /house-shipments/:houseShipmentId/close
- POST /house-shipments/:houseShipmentId/cancel
- PATCH /master-shipments/:shipmentId/mawb

## Rutas web

- /shipments/[shipmentId]/consolidations
- /house-shipments/[houseShipmentId]

## Reglas obligatorias

- HouseShipment pertenece a MasterShipment.
- HAWB unico por organizacion.
- MAWB vive en MasterShipment.
- Paquetes deben pertenecer al MasterShipment.
- CLOSED congela items y referencias.

## Auditoria

- house_shipment.created
- house_shipment.packages.replaced
- house_shipment.closed
- house_shipment.cancelled
- master_shipment.mawb.updated

## Outbox

- house_shipment.closed
- master_shipment.mawb.updated

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- manifiestos aduaneros
- SIGA
- tarifas

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 35: Consolidaciones y guias HAWB MAWB.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: HouseShipment, HouseShipmentPackage
- Permisos: shipments.read, shipments.manage
- Endpoints: GET /master-shipments/:shipmentId/house-shipments, POST /master-shipments/:shipmentId/house-shipments, GET /house-shipments/:houseShipmentId, PATCH /house-shipments/:houseShipmentId, PUT /house-shipments/:houseShipmentId/packages, POST /house-shipments/:houseShipmentId/close, POST /house-shipments/:houseShipmentId/cancel, PATCH /master-shipments/:shipmentId/mawb
- Rutas: /shipments/[shipmentId]/consolidations, /house-shipments/[houseShipmentId]

Reglas obligatorias:
- HouseShipment pertenece a MasterShipment.
- HAWB unico por organizacion.
- MAWB vive en MasterShipment.
- Paquetes deben pertenecer al MasterShipment.
- CLOSED congela items y referencias.

Fuera del alcance:
- manifiestos aduaneros
- SIGA
- tarifas

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 35. Implementa unicamente Consolidaciones y guias HAWB MAWB.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: manifiestos aduaneros, SIGA, tarifas.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 35 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: manifiestos aduaneros, SIGA, tarifas.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add airwaybills and consolidations"
git status
```
