# Despliegue

## Flujo

1. Ejecutar CI: lint, typecheck, tests y builds.
2. Crear imágenes inmutables para web y API.
3. Desplegar a staging.
4. Crear backup o snapshot.
5. Ejecutar `prisma migrate deploy` como job único.
6. Desplegar API.
7. Desplegar web.
8. Verificar healthchecks y smoke tests.
9. Monitorear errores, latencia y conexiones.

## Rollback

- Conservar imagen anterior.
- Las migraciones destructivas requieren estrategia expand/contract.
- Restaurar backup solo cuando rollback de aplicación no sea suficiente.

## Producción

PostgreSQL debe ser administrado. El despliegue puede realizarse en un PaaS, máquinas virtuales o plataforma de contenedores, manteniendo las mismas imágenes OCI.
