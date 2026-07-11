# Ticket 40 — Entrega final y confirmacion

## Rama y commit

```powershell
git switch main
git switch -c feat/final-delivery
```

Commit previsto: `feat(api): add final delivery`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- DeliveryOrder
- DeliveryOrderItem
- DeliveryAttempt

## Enums nuevos

- DeliveryMethod: HOME_DELIVERY, THIRD_PARTY, COUNTER_HANDOFF
- DeliveryStatus: DRAFT, READY, OUT_FOR_DELIVERY, DELIVERED, FAILED, CANCELLED
- DeliveryAttemptResult: DELIVERED, NOT_HOME, REJECTED, ADDRESS_ISSUE, OTHER

## Cambios en enums existentes

_Ninguno._

## Permisos

- deliveries.read
- deliveries.manage

## Endpoints

- GET /deliveries
- POST /deliveries
- GET /deliveries/:deliveryId
- PATCH /deliveries/:deliveryId
- POST /deliveries/:deliveryId/ready
- POST /deliveries/:deliveryId/dispatch
- POST /deliveries/:deliveryId/attempts
- POST /deliveries/:deliveryId/cancel

## Rutas web

- /deliveries
- /deliveries/new
- /deliveries/[deliveryId]

## Reglas obligatorias

- Paquetes disponibles y del cliente.
- Direccion como snapshot.
- OUT_FOR_DELIVERY congela items.
- DELIVERED exige intento exitoso y receptor enmascarado.
- No flota ni GPS.

## Auditoria

- delivery.created
- delivery.ready
- delivery.dispatched
- delivery.attempt.recorded
- delivery.delivered
- delivery.cancelled

## Outbox

- delivery.ready
- delivery.dispatched
- delivery.delivered
- delivery.failed

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- flota
- GPS
- rutas optimizadas
- pagos en linea

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 40: Entrega final y confirmacion.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: DeliveryOrder, DeliveryOrderItem, DeliveryAttempt
- Permisos: deliveries.read, deliveries.manage
- Endpoints: GET /deliveries, POST /deliveries, GET /deliveries/:deliveryId, PATCH /deliveries/:deliveryId, POST /deliveries/:deliveryId/ready, POST /deliveries/:deliveryId/dispatch, POST /deliveries/:deliveryId/attempts, POST /deliveries/:deliveryId/cancel
- Rutas: /deliveries, /deliveries/new, /deliveries/[deliveryId]

Reglas obligatorias:
- Paquetes disponibles y del cliente.
- Direccion como snapshot.
- OUT_FOR_DELIVERY congela items.
- DELIVERED exige intento exitoso y receptor enmascarado.
- No flota ni GPS.

Fuera del alcance:
- flota
- GPS
- rutas optimizadas
- pagos en linea

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 40. Implementa unicamente Entrega final y confirmacion.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: flota, GPS, rutas optimizadas, pagos en linea.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 40 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: flota, GPS, rutas optimizadas, pagos en linea.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add final delivery"
git status
```
