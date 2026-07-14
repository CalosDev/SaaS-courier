# UAT del piloto

Responsable: ____________________  Fecha: __________  Version: __________

## Acceso y aislamiento

- [ ] Login, logout, expiracion y rotacion de sesion funcionan.
- [ ] Un usuario sin permiso recibe 403.
- [ ] Un recurso de otra organizacion responde 404 y no filtra datos.

## Operacion principal

- [ ] Crear cliente y prealerta; recibir y medir paquete.
- [ ] Subir, descargar y eliminar un documento autorizado.
- [ ] Buscar, recibir y ubicar paquetes por escaneo.
- [ ] Transferir entre facilities y registrar discrepancias.
- [ ] Cotizar, emitir factura, confirmar y aplicar pago.
- [ ] Crear retiro, embarque, manifiesto, caso aduanero y entrega.
- [ ] Consultar tracking publico sin exponer PII.
- [ ] Solicitar y descargar reporte; confirmar expiracion.

## Integraciones y operacion

- [ ] Email transaccional llega y un fallo puede reintentarse.
- [ ] Webhook carrier firmado acepta una vez y no cambia estado interno solo.
- [ ] Readiness distingue PostgreSQL, S3 y SMTP.
- [ ] Backup y restore se verificaron en ambiente aislado.
- [ ] Runbook de incidente y rollback fue ensayado.

## Aceptacion

- [ ] No existen defectos bloqueantes abiertos.
- [ ] Riesgos residuales y responsables estan documentados.
- [ ] El responsable aprueba iniciar el piloto.

Solo despues de esta firma debe registrarse la accion de auditoria
`release.pilot.accepted`. La preparacion tecnica no equivale a aceptacion humana.
