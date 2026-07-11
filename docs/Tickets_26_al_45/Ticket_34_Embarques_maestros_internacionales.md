# Ticket 34 — Embarques maestros internacionales

## Rama y commit

```powershell
git switch main
git switch -c feat/master-shipments
```

Commit previsto: `feat(api): add master shipments`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- MasterShipment
- MasterShipmentPackage

## Enums nuevos

- MasterShipmentStatus: PLANNING, CLOSED, DEPARTED, ARRIVED, CANCELLED
- TransportMode: AIR, SEA, GROUND

## Cambios en enums existentes

_Ninguno._

## Permisos

- shipments.read
- shipments.manage

## Endpoints

- GET /master-shipments
- POST /master-shipments
- GET /master-shipments/:shipmentId
- PATCH /master-shipments/:shipmentId
- PUT /master-shipments/:shipmentId/packages
- POST /master-shipments/:shipmentId/close
- POST /master-shipments/:shipmentId/depart
- POST /master-shipments/:shipmentId/arrive
- POST /master-shipments/:shipmentId/cancel

## Rutas web

- /shipments
- /shipments/new
- /shipments/[shipmentId]

## Reglas obligatorias

- Origen y destino son facilities del tenant.
- Paquetes elegibles y no asignados a otro embarque activo.
- CLOSED congela lista.
- No guardar manifiesto aduanero dentro de MasterShipment.

## Auditoria

- master_shipment.created
- master_shipment.packages.replaced
- master_shipment.closed
- master_shipment.departed
- master_shipment.arrived
- master_shipment.cancelled

## Outbox

- master_shipment.closed
- master_shipment.departed
- master_shipment.arrived

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- HAWB/MAWB detallado
- manifiestos
- SIGA

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 34: Embarques maestros internacionales.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: MasterShipment, MasterShipmentPackage
- Permisos: shipments.read, shipments.manage
- Endpoints: GET /master-shipments, POST /master-shipments, GET /master-shipments/:shipmentId, PATCH /master-shipments/:shipmentId, PUT /master-shipments/:shipmentId/packages, POST /master-shipments/:shipmentId/close, POST /master-shipments/:shipmentId/depart, POST /master-shipments/:shipmentId/arrive, POST /master-shipments/:shipmentId/cancel
- Rutas: /shipments, /shipments/new, /shipments/[shipmentId]

Reglas obligatorias:
- Origen y destino son facilities del tenant.
- Paquetes elegibles y no asignados a otro embarque activo.
- CLOSED congela lista.
- No guardar manifiesto aduanero dentro de MasterShipment.

Fuera del alcance:
- HAWB/MAWB detallado
- manifiestos
- SIGA

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 34. Implementa unicamente Embarques maestros internacionales.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: HAWB/MAWB detallado, manifiestos, SIGA.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 34 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: HAWB/MAWB detallado, manifiestos, SIGA.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add master shipments"
git status
```
