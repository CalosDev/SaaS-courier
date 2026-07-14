# Despliegue del piloto

## Orden obligatorio

1. Ejecutar CI: lint, typecheck, pruebas, E2E y builds.
2. Publicar imagenes inmutables de API y web.
3. Crear snapshot o backup de PostgreSQL.
4. Ejecutar una sola vez el perfil de migracion.
5. Desplegar API y esperar `/health/ready`.
6. Desplegar web y ejecutar smoke tests.
7. Observar errores, latencia, outbox y entregas de email.

```powershell
docker compose -f compose.prod.yml --profile migration run --rm migrate
docker compose -f compose.prod.yml up -d api web
```

No ejecutar migraciones desde cada replica. `DATABASE_URL`, credenciales S3,
SMTP y carriers se inyectan en runtime desde el gestor de secretos.

## Rollback

- Conservar las imagenes anteriores de web y API.
- Detener el rollout si readiness falla o la tasa de errores supera el umbral.
- Revertir primero la aplicacion. Las migraciones usan expand/contract y no se
  revierten con SQL destructivo durante una incidencia.
- Restaurar PostgreSQL solo ante corrupcion o incompatibilidad confirmada, con
  autorizacion y ventana de perdida de datos conocida.

## Produccion

PostgreSQL y S3 deben ser administrados. TLS termina en el ingress o proxy;
cookies usan `Secure`, `HttpOnly` y `SameSite`. El ingress solo envia trafico a
replicas con readiness exitoso.
