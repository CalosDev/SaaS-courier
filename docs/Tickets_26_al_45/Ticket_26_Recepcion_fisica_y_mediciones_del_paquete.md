# Ticket 26 — Recepcion fisica y mediciones del paquete

## Rama y commit

```powershell
git switch main
git switch -c feat/package-reception
```

Commit previsto: `feat(api): add package reception`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- PackageReception

## Enums nuevos

- PackageCondition: SEALED, OPEN, DAMAGED, WET, CRUSHED, OTHER

## Cambios en enums existentes

- PackageStatus: + RECEIVED_AT_ORIGIN

## Permisos

- packages.receive

## Endpoints

- POST /packages/:packageId/receive
- GET /packages/:packageId/reception

## Rutas web

- /packages/[packageId]/receive

## Reglas obligatorias

- Solo RECEPTION_PENDING puede recibirse.
- Registrar facility, peso, dimensiones, piezas, condicion y empleado receptor.
- PackageReception es 1:1 y tenant-safe con Package.
- Reception, cambio de estado, audit y outbox ocurren en una sola transaccion.
- No aceptar organizationId, employeeId o status desde HTTP.

## Auditoria

- package.received

## Outbox

- package.received

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- ubicaciones de inventario
- fotografias
- clasificacion
- embarques

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 26: Recepcion fisica y mediciones del paquete.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: PackageReception
- Permisos: packages.receive
- Endpoints: POST /packages/:packageId/receive, GET /packages/:packageId/reception
- Rutas: /packages/[packageId]/receive

Reglas obligatorias:
- Solo RECEPTION_PENDING puede recibirse.
- Registrar facility, peso, dimensiones, piezas, condicion y empleado receptor.
- PackageReception es 1:1 y tenant-safe con Package.
- Reception, cambio de estado, audit y outbox ocurren en una sola transaccion.
- No aceptar organizationId, employeeId o status desde HTTP.

Fuera del alcance:
- ubicaciones de inventario
- fotografias
- clasificacion
- embarques

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 26. Implementa unicamente Recepcion fisica y mediciones del paquete.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: ubicaciones de inventario, fotografias, clasificacion, embarques.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 26 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: ubicaciones de inventario, fotografias, clasificacion, embarques.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add package reception"
git status
```
