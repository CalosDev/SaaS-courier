# Runbook del piloto

## Senales minimas

- Disponibilidad y latencia de `/health/live` y `/health/ready`.
- HTTP 5xx, p95 y saturacion de conexiones PostgreSQL.
- Outbox `PENDING`, `FAILED` y `DEAD_LETTER` por antiguedad.
- Entregas de email `FAILED` y `DEAD_LETTER`.
- Uso de disco, errores S3 y backups sin verificar.

Logs y alertas no deben incluir contrasenas, cookies, tokens, cuerpos de
documentos, secretos de carriers ni emails completos. Usar requestId,
correlationId, organizationId y codigos de error estables.

## Incidente

1. Confirmar impacto, hora inicial y organizaciones afectadas.
2. Consultar readiness y diferenciar API, PostgreSQL, S3 y SMTP.
3. Detener despliegues y preservar evidencia.
4. Si hay riesgo de datos, bloquear la mutacion afectada antes de reparar.
5. Aplicar rollback de imagen cuando el esquema siga siendo compatible.
6. Validar aislamiento, outbox y flujo critico antes de reabrir trafico.
7. Documentar causa, alcance, recuperacion y acciones preventivas.

## Umbrales iniciales

- Readiness: 100% durante despliegue.
- Smoke load: error rate <= 1% y p95 <= 750 ms en entorno local estable.
- Outbox o email pendiente: alerta si la fila mas antigua supera 5 minutos.
- Backup: alerta si no existe respaldo verificado en las ultimas 24 horas.

Los umbrales deben recalibrarse con datos del piloto, sin relajar aislamiento ni
correctitud para mejorar una metrica.
