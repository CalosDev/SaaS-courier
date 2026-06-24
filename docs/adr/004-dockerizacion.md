# ADR 004 · Dockerización

**Decisión:** imágenes separadas para web y API; PostgreSQL en Docker local y administrado en producción.

**Razón:** despliegues reproducibles sin degradar el flujo diario de desarrollo.

**Consecuencia:** desarrollo híbrido y verificación completa mediante Compose/CI.
