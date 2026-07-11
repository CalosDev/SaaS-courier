# Ticket 31 — Facturacion operativa y registro de pagos

## Rama y commit

```powershell
git switch main
git switch -c feat/operational-billing
```

Commit previsto: `feat(api): add operational invoices and payments`

## Objetivo

Implementar este bloque como entrega vertical de base de datos, API, autorizacion, auditoria/outbox, interfaz y pruebas, sin ampliar el alcance.

## Modelos

- CustomerInvoice
- InvoiceLine
- Payment
- PaymentAllocation

## Enums nuevos

- InvoiceStatus: DRAFT, ISSUED, PARTIALLY_PAID, PAID, VOID
- PaymentStatus: RECORDED, APPLIED, VOID
- PaymentMethod: CASH, CARD, BANK_TRANSFER, OTHER
- InvoiceLineType: TRANSPORT, STORAGE, INSURANCE, DELIVERY, HANDLING, OTHER

## Cambios en enums existentes

_Ninguno._

## Permisos

- billing.read
- billing.manage
- payments.manage

## Endpoints

- GET /invoices
- POST /invoices
- GET /invoices/:invoiceId
- PATCH /invoices/:invoiceId
- POST /invoices/:invoiceId/issue
- POST /invoices/:invoiceId/void
- GET /payments
- POST /payments
- POST /payments/:paymentId/apply
- POST /payments/:paymentId/void

## Rutas web

- /billing/invoices
- /billing/invoices/[invoiceId]
- /billing/payments

## Reglas obligatorias

- DRAFT editable; ISSUED congela lineas.
- Totales calculados en servidor con Decimal.
- No sobreaplicar pagos.
- VOID conserva evidencia y revierte asignaciones explicitamente.
- No mezclar facturacion operativa con facturacion SaaS.

## Auditoria

- invoice.created
- invoice.issued
- invoice.voided
- payment.recorded
- payment.applied
- payment.voided

## Outbox

- invoice.issued
- invoice.paid
- payment.recorded

## Pruebas minimas

- Happy path y validaciones.
- Aislamiento multi-tenant.
- 401, 403, 404 y 409 cuando correspondan.
- Atomicidad y rollback con audit/outbox.
- Idempotencia de acciones repetibles.
- Componentes web y Playwright para el flujo principal.
- Limpieza especifica y sin handles abiertos.

## Fuera del alcance

- pasarelas
- contabilidad general
- facturacion SaaS

## Prompt 1 — Plan para Codex

```text
Lee primero AGENTS.md. Estamos trabajando en el Ticket 31: Facturacion operativa y registro de pagos.

No modifiques archivos. Inspecciona el repositorio y presenta un plan que cubra esquema, migraciones, modulos API/web, relaciones tenant-safe, DTOs, endpoints, permisos, auditoria, outbox, pruebas, archivos y validaciones.

Implementacion aprobada del ticket:
- Modelos: CustomerInvoice, InvoiceLine, Payment, PaymentAllocation
- Permisos: billing.read, billing.manage, payments.manage
- Endpoints: GET /invoices, POST /invoices, GET /invoices/:invoiceId, PATCH /invoices/:invoiceId, POST /invoices/:invoiceId/issue, POST /invoices/:invoiceId/void, GET /payments, POST /payments, POST /payments/:paymentId/apply, POST /payments/:paymentId/void
- Rutas: /billing/invoices, /billing/invoices/[invoiceId], /billing/payments

Reglas obligatorias:
- DRAFT editable; ISSUED congela lineas.
- Totales calculados en servidor con Decimal.
- No sobreaplicar pagos.
- VOID conserva evidencia y revierte asignaciones explicitamente.
- No mezclar facturacion operativa con facturacion SaaS.

Fuera del alcance:
- pasarelas
- contabilidad general
- facturacion SaaS

Responde unicamente con el plan.
```

## Prompt 2 — Implementacion para Codex

```text
Apruebo el plan del Ticket 31. Implementa unicamente Facturacion operativa y registro de pagos.

1. Implementa exactamente los modelos, enums, permisos, endpoints y rutas aprobados.
2. Usa UUID, timestamptz(3), snake_case y relaciones tenant-safe.
3. Tenant y actor provienen del contexto autenticado, nunca del cliente.
4. Integra mutacion, audit y outbox en una misma transaccion cuando corresponda.
5. No registres secretos, tokens, cookies, credenciales ni PII innecesaria.
6. Recursos ajenos responden 404.
7. Agrega pruebas unitarias, integracion, e2e y frontend.
8. No modifiques Docker Compose sin aprobacion.
9. No hagas commits.
10. No implementes: pasarelas, contabilidad general, facturacion SaaS.

Ejecuta db:format, db:validate, db:generate, db:migrate:status, db:check, rbac:sync-permissions, outbox:status, lint, typecheck, test, test:e2e, build y git diff --check.

Informa cambios, pruebas y resultados.
```

## Prompt 3 — Revision independiente

```text
Revisa el diff del Ticket 31 como ingeniero senior de NestJS, Prisma, PostgreSQL, Next.js, seguridad multi-tenant, auditoria y outbox. No modifiques archivos.

Verifica alcance exacto, relaciones tenant-safe, permisos, DTOs, estados, idempotencia, atomicidad, sanitizacion, respuestas, frontend /backend, pruebas, migracion reproducible y que no se implemento: pasarelas, contabilidad general, facturacion SaaS.

Clasifica hallazgos como Critico, Alto, Medio o Bajo con archivo y ubicacion.
```

## Cierre

```powershell
git status
git diff --check
git add -A
git diff --cached --stat
git commit -m "feat(api): add operational invoices and payments"
git status
```
