# Ticket 37 — Gestion aduanera manual y asistida

## Rama y commit

```powershell
git switch main
git switch -c feat/customs-case-management
```

Commit previsto: `feat(api): add customs case management`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- CustomsCase
- CustomsCaseEvent

## Enums nuevos

- CustomsCaseStatus: PENDING_REVIEW, UNDER_REVIEW, RELEASED, HELD, REJECTED, CANCELLED
- CustomsEventSource: MANUAL, OFFICIAL_PORTAL, AUTHORIZED_INTEGRATION

## Cambios en enums existentes

_Ninguno._

## Permisos

- customs.read
- customs.manage

## Endpoints

- GET /customs-cases
- POST /customs-cases
- GET /customs-cases/:caseId
- POST /customs-cases/:caseId/events
- POST /customs-cases/:caseId/status

## Rutas web

- /customs/cases
- /customs/cases/[caseId]

## Reglas obligatorias

- Eventos append-only.
- Fuente obligatoria y veraz.
- No almacenar HTML, cookies o credenciales.
- Estado aduanero separado del logistico.
- No scraping.

## Auditoria

- customs_case.created
- customs_case.event.recorded
- customs_case.status.changed

## Outbox

- customs_case.status.changed

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
- SIGA
- pagos de impuestos

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 37: Gestion aduanera manual y asistida.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: CustomsCase, CustomsCaseEvent
- Permisos: customs.read, customs.manage
- Endpoints: GET /customs-cases, POST /customs-cases, GET /customs-cases/:caseId, POST /customs-cases/:caseId/events, POST /customs-cases/:caseId/status
- Rutas: /customs/cases, /customs/cases/[caseId]

Reglas obligatorias:
- Eventos append-only.
- Fuente obligatoria y veraz.
- No almacenar HTML, cookies o credenciales.
- Estado aduanero separado del logistico.
- No scraping.

Fuera del alcance:
- scraping
- SIGA
- pagos de impuestos

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 37. Implementa unicamente Gestion aduanera manual y asistida.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: scraping, SIGA, pagos de impuestos.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 37 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: scraping, SIGA, pagos de impuestos.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add customs case management"
git status
```
