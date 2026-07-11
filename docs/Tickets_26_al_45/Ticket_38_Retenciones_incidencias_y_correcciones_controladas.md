# Ticket 38 — Retenciones incidencias y correcciones controladas

## Rama y commit

```powershell
git switch main
git switch -c feat/holds-corrections
```

Commit previsto: `feat(api): add operational holds and corrections`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- OperationalHold
- CorrectionRequest
- CorrectionDecision

## Enums nuevos

- HoldStatus: ACTIVE, RELEASED, CANCELLED
- CorrectionStatus: REQUESTED, APPROVED, REJECTED, APPLIED, CANCELLED
- CorrectionTargetType: PACKAGE, PREALERT, MANIFEST, CUSTOMS_CASE, INVOICE

## Cambios en enums existentes

_Ninguno._

## Permisos

- holds.read
- holds.manage
- corrections.read
- corrections.manage

## Endpoints

- GET /holds
- POST /holds
- POST /holds/:holdId/release
- GET /corrections
- POST /corrections
- GET /corrections/:correctionId
- POST /corrections/:correctionId/approve
- POST /corrections/:correctionId/reject
- POST /corrections/:correctionId/apply

## Rutas web

- /operations/holds
- /operations/corrections
- /operations/corrections/[correctionId]

## Reglas obligatorias

- Hold bloquea operaciones definidas.
- Release requiere actor y razon.
- Correccion usa propuesta estructurada, no DTO arbitrario.
- APPLIED ejecuta correccion y evidencia atomicamente.
- No sobrescribir historial original.

## Auditoria

- hold.created
- hold.released
- correction.requested
- correction.approved
- correction.rejected
- correction.applied

## Outbox

- hold.created
- hold.released
- correction.applied

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- workflow general configurable
- firmas digitales

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 38: Retenciones incidencias y correcciones controladas.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: OperationalHold, CorrectionRequest, CorrectionDecision
- Permisos: holds.read, holds.manage, corrections.read, corrections.manage
- Endpoints: GET /holds, POST /holds, POST /holds/:holdId/release, GET /corrections, POST /corrections, GET /corrections/:correctionId, POST /corrections/:correctionId/approve, POST /corrections/:correctionId/reject, POST /corrections/:correctionId/apply
- Rutas: /operations/holds, /operations/corrections, /operations/corrections/[correctionId]

Reglas obligatorias:
- Hold bloquea operaciones definidas.
- Release requiere actor y razon.
- Correccion usa propuesta estructurada, no DTO arbitrario.
- APPLIED ejecuta correccion y evidencia atomicamente.
- No sobrescribir historial original.

Fuera del alcance:
- workflow general configurable
- firmas digitales

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 38. Implementa unicamente Retenciones incidencias y correcciones controladas.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: workflow general configurable, firmas digitales.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 38 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: workflow general configurable, firmas digitales.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add operational holds and corrections"
git status
```
