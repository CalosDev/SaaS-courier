# Ticket 29 — Interfaz operativa de almacen y escaneo

## Rama y commit

```powershell
git switch main
git switch -c feat/warehouse-workbench
```

Commit previsto: `feat(web): add warehouse workbench`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

_Ninguno._

## Enums nuevos

_Ninguno._

## Cambios en enums existentes

_Ninguno._

## Permisos

_Ninguno._

## Endpoints

- GET /warehouse/lookup?code=...
- POST /warehouse/batch/putaway

## Rutas web

- /warehouse/receive
- /warehouse/putaway
- /warehouse/search

## Reglas obligatorias

- El lector funciona como entrada de teclado.
- Lookup admite tracking interno, externo y prealerta.
- Batch putaway tiene limite y resultado por item.
- No guardar scans en localStorage.
- Optimizar para tablet y escritorio.

## Auditoria

- warehouse.batch_putaway.completed

## Outbox

- warehouse.batch_putaway.completed

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- hardware propietario
- modo offline
- GPS
- rutas de entrega

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 29: Interfaz operativa de almacen y escaneo.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: ninguno nuevo
- Permisos: ninguno nuevo
- Endpoints: GET /warehouse/lookup?code=..., POST /warehouse/batch/putaway
- Rutas: /warehouse/receive, /warehouse/putaway, /warehouse/search

Reglas obligatorias:
- El lector funciona como entrada de teclado.
- Lookup admite tracking interno, externo y prealerta.
- Batch putaway tiene limite y resultado por item.
- No guardar scans en localStorage.
- Optimizar para tablet y escritorio.

Fuera del alcance:
- hardware propietario
- modo offline
- GPS
- rutas de entrega

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 29. Implementa unicamente Interfaz operativa de almacen y escaneo.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: hardware propietario, modo offline, GPS, rutas de entrega.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 29 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: hardware propietario, modo offline, GPS, rutas de entrega.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(web): add warehouse workbench"
git status
```
