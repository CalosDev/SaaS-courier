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

La API valida la configuracion al arrancar. Produccion requiere `APP_ENV=production`,
cookies seguras, CORS HTTPS, PostgreSQL con `sslmode=require` o superior, S3 por
HTTPS, SMTP obligatorio y `FILE_SCAN_MODE=clamav` con `CLAMAV_HOST` accesible.
S3 requiere `S3_SERVER_SIDE_ENCRYPTION=AES256` o `aws:kms`; KMS requiere
`S3_KMS_KEY_ID`.
Una configuracion incompleta detiene el proceso antes de aceptar trafico.

La imagen web se construye con
`--build-arg STORAGE_PUBLIC_ORIGIN=https://objetos.example`. Ese origen se
incorpora a la CSP y debe coincidir con el host de las URLs firmadas de carga.

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

`/health/live` y `/health/ready` son publicos, limitados y no revelan nombres de
dependencias. `/health/dependencies` requiere sesion y `organizations.read`.
Configurar una politica de ciclo de vida del bucket para abortar cargas
incompletas y expirar objetos eliminados como defensa adicional.

El despliegue del piloto mantiene una sola replica API. Antes de escalar a varias
replicas, el ingress o WAF debe aplicar rate limiting distribuido; el limite en
memoria de NestJS no se considera suficiente para un despliegue horizontal.
