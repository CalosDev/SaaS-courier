# Ticket 44 — Reportes operativos y exportaciones

## Rama y commit

```powershell
git switch main
git switch -c feat/operational-reports
```

Commit previsto: `feat(api): add operational reports`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- ReportExportJob

## Enums nuevos

- ReportExportStatus: PENDING, PROCESSING, COMPLETED, FAILED, EXPIRED

## Cambios en enums existentes

_Ninguno._

## Permisos

- reports.read
- reports.export

## Endpoints

- GET /reports/operations
- GET /reports/inventory
- GET /reports/billing
- GET /reports/shipments
- GET /reports/customs
- POST /report-exports
- GET /report-exports/:exportId
- GET /report-exports/:exportId/download

## Rutas web

- /reports
- /reports/exports

## Reglas obligatorias

- Filtros siempre tenant-scoped.
- Exportaciones grandes asincronas.
- Archivos seguros y con expiracion.
- Neutralizar CSV formula injection.
- No incluir PII sensible sin permiso.
- Consultas siempre limitadas.

## Auditoria

- report_export.requested
- report_export.completed
- report_export.downloaded

## Outbox

- report_export.requested

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- BI externo
- predicciones
- data warehouse

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 44: Reportes operativos y exportaciones.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: ReportExportJob
- Permisos: reports.read, reports.export
- Endpoints: GET /reports/operations, GET /reports/inventory, GET /reports/billing, GET /reports/shipments, GET /reports/customs, POST /report-exports, GET /report-exports/:exportId, GET /report-exports/:exportId/download
- Rutas: /reports, /reports/exports

Reglas obligatorias:
- Filtros siempre tenant-scoped.
- Exportaciones grandes asincronas.
- Archivos seguros y con expiracion.
- Neutralizar CSV formula injection.
- No incluir PII sensible sin permiso.
- Consultas siempre limitadas.

Fuera del alcance:
- BI externo
- predicciones
- data warehouse

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 44. Implementa unicamente Reportes operativos y exportaciones.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: BI externo, predicciones, data warehouse.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 44 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: BI externo, predicciones, data warehouse.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add operational reports"
git status
```
