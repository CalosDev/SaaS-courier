# Estrategia Docker

## Desarrollo

- PostgreSQL siempre disponible en Compose.
- Web y API locales por defecto.
- Perfil `full` para ejecutar web y API en contenedores.
- Volúmenes solo para datos de PostgreSQL y, si se necesita, cachés de desarrollo.

## Producción

- `courier-web`: Next.js `output: standalone`.
- `courier-api`: NestJS compilado y Prisma Client generado.
- Imágenes multi-stage y usuario no root.
- Healthchecks.
- Variables inyectadas en runtime.
- PostgreSQL y S3 administrados.

## Reglas

- No incluir secretos ni `.env` en imágenes.
- No ejecutar migraciones desde cada réplica.
- No combinar web y API en un mismo contenedor.
- Usar `.dockerignore` para excluir `node_modules`, `.git`, pruebas y artefactos locales.
