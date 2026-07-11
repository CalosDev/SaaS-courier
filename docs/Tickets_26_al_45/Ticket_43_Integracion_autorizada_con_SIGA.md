# Ticket 43 — Integracion autorizada con SIGA

## Rama y commit

```powershell
git switch main
git switch -c feat/siga-integration
```

Commit previsto: `feat(api): add authorized SIGA integration`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- SigaSubmission
- SigaSubmissionAttempt
- SigaStatusSnapshot

## Enums nuevos

- SigaSubmissionStatus: DRAFT, READY, SUBMITTING, ACCEPTED, REJECTED, ERROR, CANCELLED
- SigaOperationType: MANIFEST_SUBMISSION, STATUS_QUERY, CORRECTION

## Cambios en enums existentes

_Ninguno._

## Permisos

- siga.read
- siga.manage

## Endpoints

- GET /siga/submissions
- POST /siga/submissions
- GET /siga/submissions/:submissionId
- POST /siga/submissions/:submissionId/validate
- POST /siga/submissions/:submissionId/submit
- POST /siga/submissions/:submissionId/refresh-status
- POST /siga/submissions/:submissionId/cancel

## Rutas web

- /integrations/siga
- /integrations/siga/[submissionId]

## Reglas obligatorias

- Solo mecanismos oficiales y autorizados.
- No scraping ni browser automation.
- Submission referencia manifiesto finalizado.
- Intentos y respuestas sanitizados.
- Credenciales fuera de DB/logs/audit/outbox.
- No marcar ACCEPTED sin confirmacion oficial.

## Auditoria

- siga_submission.created
- siga_submission.validated
- siga_submission.submitted
- siga_submission.status.updated
- siga_submission.cancelled

## Outbox

- siga_submission.accepted
- siga_submission.rejected

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
- credenciales compartidas
- procesos no documentados

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 43: Integracion autorizada con SIGA.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: SigaSubmission, SigaSubmissionAttempt, SigaStatusSnapshot
- Permisos: siga.read, siga.manage
- Endpoints: GET /siga/submissions, POST /siga/submissions, GET /siga/submissions/:submissionId, POST /siga/submissions/:submissionId/validate, POST /siga/submissions/:submissionId/submit, POST /siga/submissions/:submissionId/refresh-status, POST /siga/submissions/:submissionId/cancel
- Rutas: /integrations/siga, /integrations/siga/[submissionId]

Reglas obligatorias:
- Solo mecanismos oficiales y autorizados.
- No scraping ni browser automation.
- Submission referencia manifiesto finalizado.
- Intentos y respuestas sanitizados.
- Credenciales fuera de DB/logs/audit/outbox.
- No marcar ACCEPTED sin confirmacion oficial.

Fuera del alcance:
- scraping
- credenciales compartidas
- procesos no documentados

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 43. Implementa unicamente Integracion autorizada con SIGA.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: scraping, credenciales compartidas, procesos no documentados.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 43 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: scraping, credenciales compartidas, procesos no documentados.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add authorized SIGA integration"
git status
```
