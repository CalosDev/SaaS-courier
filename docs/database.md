# Base de datos

## Fuente de verdad

PostgreSQL 15+ es la fuente de verdad. Prisma se utiliza como ORM, pero las características específicas de PostgreSQL se conservan en migraciones SQL.

## Reglas principales

- `organization_id` en entidades operativas.
- Claves foráneas compuestas para impedir cruces de tenant.
- Tracking normalizado y carrier obligatorio.
- Servicios configurables.
- Tarifas sin solapamiento mediante exclusión GiST.
- Dinero en unidades menores.
- Eventos y auditoría append-only.
- Líneas de factura inmutables después de emitir.
- Pagos asignados dentro de una transacción con bloqueo.

## Migraciones

- Local: `prisma migrate dev`.
- Producción: `prisma migrate deploy`.
- Nunca ejecutar migraciones simultáneamente desde varias réplicas.
- Revisar SQL generado y añadir funciones, triggers, vistas y restricciones necesarias.

## Backups

- Backups automáticos.
- Retención definida por entorno.
- Prueba periódica de restauración.
- Snapshot antes de migraciones de riesgo.
