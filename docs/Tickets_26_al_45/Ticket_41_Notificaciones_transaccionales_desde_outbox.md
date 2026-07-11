# Ticket 41 — Notificaciones transaccionales desde outbox

## Rama y commit

```powershell
git switch main
git switch -c feat/transactional-notifications
```

Commit previsto: `feat(api): add transactional notifications`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- NotificationTemplate
- NotificationDelivery

## Enums nuevos

- NotificationChannel: EMAIL
- NotificationDeliveryStatus: PENDING, PROCESSING, SENT, FAILED, DEAD_LETTER

## Cambios en enums existentes

_Ninguno._

## Permisos

- notifications.read
- notifications.manage

## Endpoints

- GET /notification-templates
- POST /notification-templates
- PATCH /notification-templates/:templateId
- GET /notification-deliveries
- POST /notification-deliveries/:deliveryId/retry

## Rutas web

- /notifications/templates
- /notifications/deliveries

## Reglas obligatorias

- Primer consumidor real del outbox.
- Locking, attempts e idempotencia.
- Plantillas con variables allowlisted.
- Secretos del proveedor fuera de PostgreSQL.
- Enviar fuera de la transaccion de negocio.
- Solo EMAIL en este ticket.

## Auditoria

- notification_template.created
- notification_template.updated
- notification_delivery.retried

## Outbox

_Ninguno._

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- SMS
- WhatsApp
- marketing
- campanas
- push

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 41: Notificaciones transaccionales desde outbox.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: NotificationTemplate, NotificationDelivery
- Permisos: notifications.read, notifications.manage
- Endpoints: GET /notification-templates, POST /notification-templates, PATCH /notification-templates/:templateId, GET /notification-deliveries, POST /notification-deliveries/:deliveryId/retry
- Rutas: /notifications/templates, /notifications/deliveries

Reglas obligatorias:
- Primer consumidor real del outbox.
- Locking, attempts e idempotencia.
- Plantillas con variables allowlisted.
- Secretos del proveedor fuera de PostgreSQL.
- Enviar fuera de la transaccion de negocio.
- Solo EMAIL en este ticket.

Fuera del alcance:
- SMS
- WhatsApp
- marketing
- campanas
- push

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 41. Implementa unicamente Notificaciones transaccionales desde outbox.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: SMS, WhatsApp, marketing, campanas, push.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 41 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: SMS, WhatsApp, marketing, campanas, push.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add transactional notifications"
git status
```
