# Resultados UAT del piloto

Fecha: 2026-07-14
Entorno: local reproducible con PostgreSQL, MinIO y Mailpit
Version base: `62451b1`
Responsable de ejecucion tecnica: Codex
Responsable de aceptacion de negocio: Manuel

## Resultado

Estado tecnico: `PASS`
Defectos bloqueantes abiertos: `0`
Decision de negocio: `PENDIENTE DE FIRMA`

La evidencia tecnica permite iniciar el piloto. La accion
`release.pilot.accepted` no debe registrarse hasta recibir confirmacion explicita
del responsable de negocio.

## Evidencia live con Playwright CLI

| Escenario | Resultado | Evidencia |
|---|---:|---|
| Login con tenant resuelto por `localhost` | PASS | Dashboard de Courier Local cargado. |
| Dashboard y onboarding | PASS | `output/playwright/uat/01-dashboard.png`; estado READY. |
| Crear cliente | PASS | Cliente `CSUR2SDZL`, Ana UAT. |
| Crear prealerta | PASS | Prealerta `PA3J7DGU2B2W`, tracking `1ZUAT202607140001`. |
| Registrar y recibir paquete | PASS | Paquete `PKKS8ZMW46LKJA`, 3.25 LB, 12 x 8 x 5 IN. |
| Politica documental negativa | PASS | Factura `text/plain` rechazada con 400. |
| Cargar, descargar y eliminar documento | PASS | Foto disponible, descargada y eliminada; `04-document-available.png`. |
| Crear ubicacion y putaway por scan | PASS | `UAT-A-01`; 1 procesado, 1 ubicado, 0 fallidos; `05-putaway-completed.png`. |
| Tracking publico | PASS | Estado visible sin nombre, email, telefono ni direccion; `06-public-tracking.png`. |
| Estado del sistema | PASS | PostgreSQL, object storage y SMTP `up`; `07-system-ready.png`. |
| Reporte y exportacion | PASS | OPERATIONS con 1 fila y CSV descargado; `08-report-export.png`. |
| Email transaccional | PASS | Plantilla `UAT_PACKAGE_CREATED`, entrega SENT y mensaje recibido en Mailpit; `09-email-sent.png`. |
| Logout y proteccion posterior | PASS | Logout 204; `/dashboard` redirige a `/login?next=%2Fdashboard`. |

Las capturas y descargas son artefactos locales ignorados por Git. No contienen
credenciales ni tokens.

## Evidencia de integracion

- `pnpm test:e2e`: API 42 suites / 43 tests y web 20 flujos, todos PASS.
- Aislamiento tenant: recursos ajenos 404 y pruebas de acceso sin permiso 403.
- Transferencias: despacho, recepcion y discrepancias persistidas tenant-safe.
- Facturacion: emision, pago y concurrencia PostgreSQL sin sobreaplicacion.
- Retiro, embarque, manifiesto, aduanas y entrega: repositorios y contratos E2E PASS.
- Carrier: HMAC, tolerancia temporal, replay idempotente y estado interno independiente PASS.
- Reportes: generacion, descarga y expiracion controlada PASS.
- Notificaciones: fallo, reintento y dead-letter cubiertos por pruebas unitarias e integracion.

## Infraestructura y recuperacion

- `pnpm pilot:integrations:check`: S3 write/read/delete y SMTP PASS.
- `pnpm pilot:backup`: respaldo creado.
- `pnpm pilot:restore:verify`: restauracion aislada PASS con 37 migraciones.
- Ejercicio SMTP: Mailpit detenido produjo readiness 503; tras reinicio regreso a 200.
- Runbook aplicado: deteccion por dependencia, recuperacion y verificacion posterior.

## Defectos encontrados y corregidos

1. `bootstrap-local.ts` no creaba `OrganizationSettings`, por lo que dashboard y
   onboarding respondian 404. Se agrego un upsert idempotente dentro de la
   transaccion local.
2. El filtro HTTP convertia `ServiceUnavailableException` de readiness en 500.
   Ahora preserva estados HTTP explicitos hasta 599 y tiene prueba de regresion
   para 503.

## Riesgos residuales

- La aceptacion refleja un entorno local reproducible, no trafico real de piloto.
- UPS, FedEx y DHL requieren certificacion separada con credenciales sandbox.
- SIGA/DGA permanece fuera de alcance hasta autorizacion oficial.
- Las exportaciones temporales permanecen en PostgreSQL por decision vigente.
- Los umbrales de carga deben recalibrarse con telemetria real sin relajar
  aislamiento ni correctitud.

## Firma

Decision: [ ] APROBADA  [ ] APROBADA CON OBSERVACIONES  [ ] RECHAZADA

Responsable: ____________________

Fecha y hora: ____________________

Observaciones: ____________________________________________________________
