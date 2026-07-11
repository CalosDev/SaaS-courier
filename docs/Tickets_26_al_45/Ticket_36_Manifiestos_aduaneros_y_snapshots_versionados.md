# Ticket 36 — Manifiestos aduaneros y snapshots versionados

## Rama y commit

```powershell
git switch main
git switch -c feat/customs-manifests
```

Commit previsto: `feat(api): add customs manifests`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- CustomsManifest
- CustomsManifestVersion
- CustomsManifestItem

## Enums nuevos

- CustomsManifestStatus: DRAFT, VALIDATED, FINALIZED, CANCELLED
- CustomsManifestValidationStatus: PENDING, VALID, INVALID

## Cambios en enums existentes

_Ninguno._

## Permisos

- manifests.read
- manifests.manage

## Endpoints

- GET /customs-manifests
- POST /customs-manifests
- GET /customs-manifests/:manifestId
- POST /customs-manifests/:manifestId/build-version
- POST /customs-manifests/:manifestId/validate
- POST /customs-manifests/:manifestId/finalize
- POST /customs-manifests/:manifestId/cancel

## Rutas web

- /customs/manifests
- /customs/manifests/[manifestId]

## Reglas obligatorias

- Manifest referencia MasterShipment pero conserva snapshot propio.
- Cada build crea version inmutable.
- Validacion no modifica datos operativos.
- FINALIZED congela version.
- No transmitir a DGA/SIGA.

## Auditoria

- customs_manifest.created
- customs_manifest.version.created
- customs_manifest.validated
- customs_manifest.finalized
- customs_manifest.cancelled

## Outbox

- customs_manifest.finalized

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- transmision SIGA
- automatizacion aduanera

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 36: Manifiestos aduaneros y snapshots versionados.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: CustomsManifest, CustomsManifestVersion, CustomsManifestItem
- Permisos: manifests.read, manifests.manage
- Endpoints: GET /customs-manifests, POST /customs-manifests, GET /customs-manifests/:manifestId, POST /customs-manifests/:manifestId/build-version, POST /customs-manifests/:manifestId/validate, POST /customs-manifests/:manifestId/finalize, POST /customs-manifests/:manifestId/cancel
- Rutas: /customs/manifests, /customs/manifests/[manifestId]

Reglas obligatorias:
- Manifest referencia MasterShipment pero conserva snapshot propio.
- Cada build crea version inmutable.
- Validacion no modifica datos operativos.
- FINALIZED congela version.
- No transmitir a DGA/SIGA.

Fuera del alcance:
- transmision SIGA
- automatizacion aduanera

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 36. Implementa unicamente Manifiestos aduaneros y snapshots versionados.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: transmision SIGA, automatizacion aduanera.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 36 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: transmision SIGA, automatizacion aduanera.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add customs manifests"
git status
```
