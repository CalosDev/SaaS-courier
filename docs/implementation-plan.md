# Plan de implementación

## Fase 0 · Infraestructura

- pnpm workspaces y Turborepo.
- Next.js y NestJS en TypeScript estricto.
- PostgreSQL en Docker.
- Prisma inicial y migraciones.
- `/health` en API y verificación desde web.
- ESLint, typecheck, test y build desde la raíz.
- CI básica.

**Aceptación:** `pnpm install`, `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` funcionan.

## Fase 1 · Tenant y autenticación

- Organizations y status.
- Users, sessions, refresh rotation.
- Employees y employee_facilities.
- Guards por tenant, rol y facility.
- Pruebas de aislamiento.

## Fase 2 · Corte vertical operativo

- Facilities y storage locations.
- Customers y mailbox.
- Carrier UNKNOWN y catálogo de carriers.
- Services configurables.
- Packages, recepción, peso y dimensiones.
- Package events, ubicación y tracking público.

## Fase 3 · Transferencias

- Manifiestos.
- Escaneos de salida y entrada.
- Discrepancias.
- Reglas para evitar transfers activos duplicados.

## Fase 4 · Tarifas y finanzas

- Rate rules y cotización.
- Facturas draft/issue.
- Pagos pending/confirm/allocate.
- Bloqueos y pruebas concurrentes.

## Fase 5 · Portal y piloto

- Portal de cliente.
- Backoffice.
- Etiquetas e impresión.
- Importación inicial.
- Métricas y capacitación.
