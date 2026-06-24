# AGENTS.md

## Producto

SaaS multi-tenant para empresas de courier en República Dominicana. Cada courier es una `organization` aislada con facilities internas.

## Arquitectura obligatoria

- `apps/web`: Next.js, React y TypeScript.
- `apps/api`: NestJS, Prisma y TypeScript estricto.
- PostgreSQL es la fuente de verdad.
- NestJS es el único propietario de reglas de negocio.
- Next.js nunca accede directamente a PostgreSQL.
- No usar microservicios durante el MVP.

## Multi-tenancy

- Toda entidad operativa contiene `organizationId`.
- `organizationId` se obtiene del host y de la sesión autenticada.
- Nunca confiar en un `organizationId` del body, query o header del navegador.
- Toda consulta administrativa se filtra por organization.
- Las pruebas incluyen intentos de acceso cruzado.

## Base de datos

- No usar `prisma db push` en producción.
- Usar migraciones versionadas.
- Funciones, vistas, triggers y exclusiones PostgreSQL se guardan en SQL de migración.
- Dinero en unidades menores con `bigint`.
- `package_events` y `audit_logs` son append-only.
- Estados, facturación y pagos usan transacciones.
- Las líneas de factura no cambian después de emitir.

## Seguridad

- No guardar secretos en Git.
- No usar `localStorage` para tokens.
- Usar cookies HttpOnly, Secure y SameSite.
- Validar DTOs en NestJS.
- No registrar contraseñas, tokens ni datos sensibles.
- Rate limiting en login y tracking público.

## Docker

- Dockerfiles multi-stage.
- Contenedores de producción no root.
- Imágenes separadas para web y API.
- No copiar `.env` dentro de imágenes.
- Migraciones como job único de despliegue.
- PostgreSQL administrado en producción.

## Comandos obligatorios

Antes de finalizar una tarea:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Para cambios de base de datos, ejecutar además pruebas de integración.

## Definición de terminado

Una tarea está terminada cuando cumple criterios de aceptación, tiene pruebas, no rompe lint/tipos/build, mantiene aislamiento, actualiza documentación y no introduce dependencias injustificadas.
