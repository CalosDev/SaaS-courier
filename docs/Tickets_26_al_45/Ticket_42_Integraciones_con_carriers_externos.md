# Ticket 42 — Integraciones con carriers externos

## Rama y commit

```powershell
git switch main
git switch -c feat/carrier-integrations
```

Commit previsto: `feat(api): add carrier integrations`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- CarrierConnection
- CarrierTrackingSnapshot
- CarrierWebhookReceipt

## Enums nuevos

- CarrierConnectionStatus: ACTIVE, DISABLED, ERROR
- CarrierEventStatus: IN_TRANSIT, DELIVERED, EXCEPTION, UNKNOWN

## Cambios en enums existentes

_Ninguno._

## Permisos

- carriers.read
- carriers.manage

## Endpoints

- GET /carrier-connections
- POST /carrier-connections
- PATCH /carrier-connections/:connectionId
- POST /carrier-connections/:connectionId/test
- GET /packages/:packageId/carrier-events
- POST /webhooks/carriers/:connectionKey

## Rutas web

- /integrations/carriers
- /packages/[packageId] (seccion carrier)

## Reglas obligatorias

- Credenciales mediante secret provider.
- Webhook firmado, replay protection e idempotencia.
- Carrier DELIVERED no confirma recepcion interna.
- Snapshots append-only y sanitizados.
- Solo conectores autorizados.

## Auditoria

- carrier_connection.created
- carrier_connection.updated
- carrier_connection.tested

## Outbox

- carrier.tracking.updated

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- scraping
- recepcion automatica
- carriers no autorizados

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 42: Integraciones con carriers externos.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: CarrierConnection, CarrierTrackingSnapshot, CarrierWebhookReceipt
- Permisos: carriers.read, carriers.manage
- Endpoints: GET /carrier-connections, POST /carrier-connections, PATCH /carrier-connections/:connectionId, POST /carrier-connections/:connectionId/test, GET /packages/:packageId/carrier-events, POST /webhooks/carriers/:connectionKey
- Rutas: /integrations/carriers, /packages/[packageId] (seccion carrier)

Reglas obligatorias:
- Credenciales mediante secret provider.
- Webhook firmado, replay protection e idempotencia.
- Carrier DELIVERED no confirma recepcion interna.
- Snapshots append-only y sanitizados.
- Solo conectores autorizados.

Fuera del alcance:
- scraping
- recepcion automatica
- carriers no autorizados

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 42. Implementa unicamente Integraciones con carriers externos.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: scraping, recepcion automatica, carriers no autorizados.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 42 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: scraping, recepcion automatica, carriers no autorizados.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add carrier integrations"
git status
```
