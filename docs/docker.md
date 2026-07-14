# Estrategia Docker

## Desarrollo

`compose.dev.yml` inicia PostgreSQL, MinIO y Mailpit. Web y API se ejecutan con
pnpm para conservar recarga rapida. MinIO crea un bucket privado idempotente y
Mailpit captura correo sin entregarlo a Internet.

## Produccion

- `courier-web`: Next.js con `output: standalone`.
- `courier-api`: NestJS compilado y Prisma Client generado.
- Imagenes multi-stage y proceso final no root.
- `/health/live` indica proceso vivo; `/health/ready` valida dependencias sin
  revelar su identidad. El detalle autenticado vive en `/health/dependencies`.
- `migrate` es un job de despliegue unico, no una replica permanente.
- PostgreSQL y object storage son servicios administrados.
- El escaneo ClamAV se despliega como dependencia interna separada y nunca se
  expone directamente a Internet.

## Reglas

- No copiar `.env`, secretos, pruebas ni artefactos locales a imagenes.
- No combinar web y API en un contenedor.
- No ejecutar `prisma db push` en produccion.
- Fijar las imagenes publicadas por digest en el entorno real.
