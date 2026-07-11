# Tickets 26 al 45 — Courier SaaS

Este ZIP contiene **20 tickets**, cada uno en un archivo Markdown independiente.

Cada ticket incluye alcance, modelos, enums, permisos, endpoints, rutas web, auditoria, outbox, pruebas y tres prompts para Codex.

| Ticket | Titulo | Rama |
|---:|---|---|
| 26 | Recepcion fisica y mediciones del paquete | `feat/package-reception` |
| 27 | Documentos facturas y fotografias del paquete | `feat/package-documents` |
| 28 | Inventario y ubicaciones de almacen | `feat/warehouse-inventory` |
| 29 | Interfaz operativa de almacen y escaneo | `feat/warehouse-workbench` |
| 30 | Catalogo de servicios y tarifas versionadas | `feat/rates-catalog` |
| 31 | Facturacion operativa y registro de pagos | `feat/operational-billing` |
| 32 | Solicitudes de retiro en sucursal | `feat/pickup-requests` |
| 33 | Tracking unificado y consulta publica limitada | `feat/public-tracking` |
| 34 | Embarques maestros internacionales | `feat/master-shipments` |
| 35 | Consolidaciones y guias HAWB MAWB | `feat/airwaybills-consolidation` |
| 36 | Manifiestos aduaneros y snapshots versionados | `feat/customs-manifests` |
| 37 | Gestion aduanera manual y asistida | `feat/customs-case-management` |
| 38 | Retenciones incidencias y correcciones controladas | `feat/holds-corrections` |
| 39 | Transferencias internas entre facilities | `feat/facility-transfers` |
| 40 | Entrega final y confirmacion | `feat/final-delivery` |
| 41 | Notificaciones transaccionales desde outbox | `feat/transactional-notifications` |
| 42 | Integraciones con carriers externos | `feat/carrier-integrations` |
| 43 | Integracion autorizada con SIGA | `feat/siga-integration` |
| 44 | Reportes operativos y exportaciones | `feat/operational-reports` |
| 45 | Hardening piloto y aceptacion operativa | `chore/pilot-readiness` |

## Reglas globales

- SaaS B2B multiempresa para couriers existentes.
- Tenant y actor derivados de la sesion.
- Recursos ajenos se tratan como no encontrados.
- Mutaciones criticas, audit y outbox deben ser atomicos.
- El frontend usa `/backend` y no envia `organizationId`.
- No se amplia un ticket sin aprobacion.
- El Ticket 45 cierra el piloto y no introduce un dominio nuevo.
