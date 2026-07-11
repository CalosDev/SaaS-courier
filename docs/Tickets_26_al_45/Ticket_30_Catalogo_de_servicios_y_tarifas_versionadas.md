# Ticket 30 — Catalogo de servicios y tarifas versionadas

## Rama y commit

```powershell
git switch main
git switch -c feat/rates-catalog
```

Commit previsto: `feat(api): add service and rate catalog`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- CourierService
- RateCard
- RateRule

## Enums nuevos

- RateCalculationType: FLAT, PER_WEIGHT, TIERED_WEIGHT, PER_PIECE
- RateRuleStatus: DRAFT, ACTIVE, RETIRED

## Cambios en enums existentes

_Ninguno._

## Permisos

- rates.read
- rates.manage

## Endpoints

- GET /services
- POST /services
- PATCH /services/:serviceId
- GET /rate-cards
- POST /rate-cards
- GET /rate-cards/:rateCardId
- PATCH /rate-cards/:rateCardId
- PUT /rate-cards/:rateCardId/rules
- POST /rate-cards/:rateCardId/activate
- POST /rates/quote

## Rutas web

- /rates/services
- /rates/cards
- /rates/cards/[rateCardId]

## Reglas obligatorias

- Tarifas activas son inmutables; cambios crean nueva version.
- No permitir solapamientos para el mismo servicio y segmento.
- Quote es determinista y no crea factura.
- Usar unidades configuradas.
- Separar cargos del courier de montos aduaneros.

## Auditoria

- service.created
- service.updated
- rate_card.created
- rate_card.activated
- rate_rules.replaced

## Outbox

- rate_card.activated

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- facturas
- pagos
- suscripcion SaaS

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 30: Catalogo de servicios y tarifas versionadas.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: CourierService, RateCard, RateRule
- Permisos: rates.read, rates.manage
- Endpoints: GET /services, POST /services, PATCH /services/:serviceId, GET /rate-cards, POST /rate-cards, GET /rate-cards/:rateCardId, PATCH /rate-cards/:rateCardId, PUT /rate-cards/:rateCardId/rules, POST /rate-cards/:rateCardId/activate, POST /rates/quote
- Rutas: /rates/services, /rates/cards, /rates/cards/[rateCardId]

Reglas obligatorias:
- Tarifas activas son inmutables; cambios crean nueva version.
- No permitir solapamientos para el mismo servicio y segmento.
- Quote es determinista y no crea factura.
- Usar unidades configuradas.
- Separar cargos del courier de montos aduaneros.

Fuera del alcance:
- facturas
- pagos
- suscripcion SaaS

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 30. Implementa unicamente Catalogo de servicios y tarifas versionadas.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: facturas, pagos, suscripcion SaaS.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 30 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: facturas, pagos, suscripcion SaaS.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add service and rate catalog"
git status
```
