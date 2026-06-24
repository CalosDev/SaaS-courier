# ADR 006 · Prisma más SQL PostgreSQL

**Decisión:** Prisma administra el modelo común y las migraciones incluyen SQL específico.

**Razón:** el dominio necesita vistas, triggers, exclusiones y funciones.

**Consecuencia:** no usar `db push` en producción y revisar cada migración.
