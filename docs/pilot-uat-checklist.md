# UAT del piloto

Responsable: Manuel (firma pendiente)  Fecha: 2026-07-14  Version: 62451b1 + correcciones UAT

Estado tecnico: COMPLETADO. Estado de negocio: PENDIENTE DE APROBACION DEL RESPONSABLE.

## Acceso y aislamiento

- [x] Login, logout, expiracion y rotacion de sesion funcionan.
- [x] Un usuario sin permiso recibe 403.
- [x] Un recurso de otra organizacion responde 404 y no filtra datos.

## Operacion principal

- [x] Crear cliente y prealerta; recibir y medir paquete.
- [x] Subir, descargar y eliminar un documento autorizado.
- [x] Buscar, recibir y ubicar paquetes por escaneo.
- [x] Transferir entre facilities y registrar discrepancias.
- [x] Cotizar, emitir factura, confirmar y aplicar pago.
- [x] Crear retiro, embarque, manifiesto, caso aduanero y entrega.
- [x] Consultar tracking publico sin exponer PII.
- [x] Solicitar y descargar reporte; confirmar expiracion.

## Integraciones y operacion

- [x] Email transaccional llega y un fallo puede reintentarse.
- [x] Webhook carrier firmado acepta una vez y no cambia estado interno solo.
- [x] Readiness distingue PostgreSQL, S3 y SMTP.
- [x] Backup y restore se verificaron en ambiente aislado.
- [x] Runbook de incidente y rollback fue ensayado.

## Aceptacion

- [x] No existen defectos bloqueantes abiertos.
- [x] Riesgos residuales y responsables estan documentados.
- [ ] El responsable aprueba iniciar el piloto.

Evidencia y riesgos: `docs/archive/pilot-uat-results-2026-07-14.md`.

Solo despues de esta firma debe registrarse la accion de auditoria
`release.pilot.accepted`. La preparacion tecnica no equivale a aceptacion humana.
