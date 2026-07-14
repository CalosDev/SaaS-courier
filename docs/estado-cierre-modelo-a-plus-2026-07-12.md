# Estado de cierre contra Documento Maestro Modelo A+

Fecha de corte: 2026-07-14
Documento fuente: documento maestro Modelo A+ provisto por producto.
Repositorio revisado: raiz del monorepo Courier SaaS.

## Criterio de lectura

Este documento contrasta el estado actual del repositorio contra el Documento Maestro de Enfoque del Proyecto, version 1.1, con alcance de Ticket 0 a Ticket 45.

Durante el cierre del Modelo A+, este documento es la matriz operativa oficial de estado. El alcance funcional queda congelado en los Tickets 0 a 45: no se agregaran nuevos modulos, integraciones, rutas ni ampliaciones funcionales hasta completar la linea base P0 y resolver los hallazgos bloqueantes del piloto.

Estados usados:

- `listo`: existe implementacion en codigo y fue validada en esta sesion con lint, tipos, tests, build o Playwright segun aplique.
- `parcial`: existe implementacion principal, pero falta una parte del alcance, cobertura dedicada, endurecimiento o validacion e2e completa.
- `pendiente`: no hay evidencia suficiente de implementacion del alcance esperado.
- `no verificado`: existe codigo o documento, pero no se pudo ejecutar la verificacion requerida en esta sesion.
- `bloqueado`: la validacion no puede continuar por una dependencia externa o de entorno identificada.
- `fuera de alcance`: trabajo valido para una fase posterior, pero no requerido para cerrar el piloto actual.

## Alcance congelado de cierre

| Incluido | Pospuesto hasta despues del piloto |
|---|---|
| Estabilizacion de los Tickets 0 a 45 | Portal de clientes |
| Pruebas, seguridad, aislamiento tenant y permisos | Nuevas integraciones con carriers |
| Migraciones, Docker, backup y restauracion | Automatizaciones adicionales de SIGA/DGA |
| Flujos operativos ya aprobados | Analitica avanzada y nuevos reportes |
| Observabilidad minima y aceptacion operativa | Microservicios, Redis y escalado distribuido no demostrado |

Todo hallazgo del cierre debe resolverse con el cambio compatible mas pequeno. Un hallazgo no autoriza refactors amplios ni cambios de contratos, rutas, permisos, copy o estilos.

## Resumen ejecutivo

El producto ya supera el bootstrap. El repositorio contiene un monorepo operativo con `apps/web` en Next.js, `apps/api` en NestJS, Prisma 7, PostgreSQL, migraciones versionadas, RBAC, sesiones con cookies HttpOnly, CSRF, auditoria, outbox y modulos de operacion courier hasta dominios avanzados.

La revision automatizada cubre API, repositorios PostgreSQL y 20 flujos Playwright sobre build de produccion. El cierre incluye almacenamiento S3 compatible, SMTP reproducible, operaciones de almacen, notificaciones transaccionales, integraciones carrier desacopladas del estado interno, Docker productivo, migraciones como job unico, backup/restore y prueba de carga. Los defectos encontrados durante QA quedaron corregidos con pruebas de regresion.

## Evidencia de cierre reciente

Comandos ejecutados y resultado:

| Comando | Resultado | Nota |
|---|---:|---|
| `pnpm lint` | `listo` | API y web pasaron. |
| `pnpm typecheck` | `listo` | API y web pasaron. |
| `pnpm test` | `listo` | API: 69 suites / 445 tests. Web: 33 archivos / 59 tests. |
| `pnpm build` | `listo` | API y web construyen correctamente. |
| `git diff --check` | `listo` | Sin whitespace problematico. |
| `pnpm test:e2e` | `listo` | API: 42 suites / 43 tests. Web Playwright: 20 flujos. |
| `pnpm outbox:status` | `listo` | Outbox sin pendientes ni fallos. |
| `pnpm db:validate` | `listo` | El esquema Prisma es valido. |
| `pnpm db:migrate:status` | `listo` | PostgreSQL saludable, 37 migraciones encontradas y esquema actualizado. |
| `pnpm db:check` | `listo` | Conexion verificada mediante `SELECT 1`. |
| `pnpm rbac:sync-permissions` | `listo` | Catalogo consistente: 54 permisos. |
| `pnpm pilot:integrations:check` | `listo` | Escritura/lectura/borrado real en MinIO y envio SMTP real a Mailpit. |
| `pnpm pilot:backup` + `pnpm pilot:restore:verify` | `listo` | Backup generado y restaurado en base aislada con 37 migraciones. |
| `pnpm pilot:load` | `listo` | 200 solicitudes, concurrencia 20, error rate 0.5% y p95 122 ms. |
| Imagenes Docker web/API y job de migracion | `listo` | Contenedores non-root; web responde 200; API ready con PostgreSQL/S3/SMTP; migracion sin pendientes. |

## Cambios cerrados en esta fase

| Area | Cambio | Estado |
|---|---|---:|
| API start de produccion | `apps/api/package.json` ahora usa `node dist/src/main`, que coincide con la salida real de `nest build`. | `listo` |
| Backoffice de transferencias | `/transfers` acepta `FacilityTransfer[]` y mantiene compatibilidad con `{ items: FacilityTransfer[] }`. | `listo` |
| Regresion de transferencias | Se agrego `apps/web/src/app/(backoffice)/transfers/page.test.tsx` con cobertura para respuesta array y paginada. | `listo` |
| Artefactos QA | `.gitignore` ignora `output/` para no subir logs/screenshots de Playwright. | `listo` |

## Matriz contra principios del Documento Maestro

| Principio / regla | Estado | Evidencia o pendiente |
|---|---:|---|
| SaaS B2B para couriers existentes, no empresa courier | `listo` | El modelo mantiene `Organization` como tenant y backoffice operativo. |
| Multiempresa estricta | `listo` | Consultas tenant-safe y pruebas de acceso cruzado en dominios operativos, notificaciones y carriers. |
| NestJS como propietario de reglas de negocio | `listo` | Modulos de dominio estan en API; Next usa cliente HTTP y `/backend`. |
| Next.js no accede directo a PostgreSQL | `listo` | Frontend usa `backofficeApi` y rewrite `/backend/*`. |
| PostgreSQL como fuente de verdad | `listo` | Prisma y migraciones versionadas presentes. |
| Auditoria/outbox atomicos en mutaciones criticas | `listo` | Mutaciones nuevas escriben evidencia y eventos dentro de transacciones; outbox sin fallos al cierre. |
| No confiar en `organizationId` del navegador | `listo` | Contexto tenant deriva de host/sesion y las pruebas contractuales rechazan o evitan identidad tenant desde UI. |
| No mezclar facturacion SaaS con facturacion operativa | `parcial` | Modulo billing es operativo; falta revision funcional profunda de procesos contables/conciliacion. |
| Carrier externo no manda estado interno | `listo` | Webhooks firmados almacenan snapshots append-only; E2E confirma que no mutan el estado interno del paquete. |
| SIGA solo con autorizacion oficial | `listo` | La transmision simulada, su endpoint y sus acciones UI fueron retirados; no existe automatizacion operativa sin autorizacion oficial. |

## Matriz de tickets 26 al 45

| Ticket | Alcance del documento maestro | Estado | Observacion |
|---:|---|---:|---|
| 26 | Recepcion fisica y mediciones | `listo` | Implementado con recepcion, mediciones, pruebas y build verde. |
| 27 | Documentos, facturas y fotografias del paquete | `listo` | Storage S3 compatible validado con escritura, lectura y borrado real en MinIO; documentos mantienen aislamiento tenant. |
| 28 | Inventario y ubicaciones de almacen | `listo` | Modulo API/web, tests y Playwright de rutas de inventario pasaron. |
| 29 | Interfaz operativa de almacen y escaneo | `listo` | Busqueda, recepcion y putaway por lote implementados; Playwright valida el flujo y evita movimientos redundantes. |
| 30 | Catalogo de servicios y tarifas versionadas | `listo` | Servicios, tarifarios versionados, reglas, activacion y cotizacion tienen cobertura API y Playwright dedicada; el flujo web evita campos tenant/actor y fue corregido para refrescar formularios y navegar con semantica valida. |
| 31 | Facturacion operativa y pagos | `listo` | Lineas inmutables tras emision, totales en unidades menores, clientes/monedas tenant-safe, locks PostgreSQL contra sobreaplicacion, anulacion con asignaciones revertidas y evidencia persistida, detalle web, E2E concurrente y Playwright validados. |
| 32 | Solicitudes de retiro en sucursal | `listo` | Flujo vertical con elegibilidad operativa/financiera, bloqueo concurrente, aislamiento tenant, auditoria/outbox, rutas web contractuales y Playwright dedicado. |
| 33 | Tracking unificado y consulta publica limitada | `listo` | Resolucion por tracking interno, externo o prealerta, slug obligatorio, aislamiento tenant, respuesta sin PII ni textos libres, no-store, rate limiting, ruta publica, E2E HTTP y Playwright validados. |
| 34 | Embarques maestros internacionales | `listo` | Facilities de origen/destino tenant-safe, modo AIR/SEA/GROUND, lista congelada al cerrar, transiciones semanticas, estados de paquetes en salida/llegada, aislamiento tenant, E2E PostgreSQL y Playwright validados. |
| 35 | Consolidaciones y HAWB/MAWB | `listo` | HAWB unico, pertenencia al embarque maestro, reemplazo atomico de paquetes, referencias compuestas tenant-safe, cierre/cancelacion controlados y E2E PostgreSQL validados. |
| 36 | Manifiestos aduaneros y snapshots versionados | `listo` | Manifiesto enlazado al embarque maestro, versiones e items inmutables, validacion sin mutar datos operativos, finalizacion congelada, cancelacion controlada, aislamiento tenant, E2E PostgreSQL y Playwright validados sin transmision SIGA/DGA. |
| 37 | Gestion aduanera manual/asistida | `listo` | Eventos append-only protegidos en PostgreSQL, actor y evidencia persistidos, fuentes manual/portal verificadas, integracion no disponible desde UI/API manual, estados controlados e independientes de logistica, aislamiento tenant, outbox de estado, E2E y Playwright validados sin SIGA/DGA. |
| 38 | Retenciones e incidencias/correcciones | `listo` | Holds/corrections implementados y flujo de holds sobre paquetes fue endurecido. |
| 39 | Transferencias internas entre facilities | `listo` | Origen/destino distintos, paquetes en origen, transferencia activa unica, despacho con `REMOVE`, recepcion con `PUTAWAY`, discrepancias, cancelacion DRAFT, aislamiento tenant y E2E PostgreSQL validados. |
| 40 | Entrega final y confirmacion | `listo` | Creacion con paquetes elegibles del cliente, snapshot de direccion, transiciones DRAFT/READY/OUT_FOR_DELIVERY, tres intentos fallidos, entrega exitosa con receptor enmascarado, cancelacion DRAFT, aislamiento tenant y E2E PostgreSQL validados. |
| 41 | Notificaciones transaccionales desde outbox | `listo` | Plantillas, entregas, consumidor outbox, reintentos/dead-letter y SMTP real local validados con unitarias, E2E y Playwright. |
| 42 | Integraciones con carriers externos | `listo` | Conexiones por referencia de secreto, HMAC, tolerancia temporal, idempotencia y evidencia append-only validadas. La certificacion contra sandbox de cada carrier requiere credenciales externas. |
| 43 | Integracion autorizada con SIGA | `fuera de alcance` | No hay autorizacion oficial ni contrato externo; la simulacion que aparentaba transmision real fue eliminada. |
| 44 | Reportes operativos y exportaciones | `listo` | Cinco reportes tenant-safe, filtros acotados, permisos separados de lectura/exportacion, jobs asincronos idempotentes, CSV neutralizado y con expiracion, auditoria/outbox, E2E PostgreSQL y Playwright validados. |
| 45 | Hardening piloto y aceptacion operativa | `parcial` | Hardening tecnico, Docker, backup/restore, readiness, carga, runbook y checklist estan listos. Solo falta ejecucion y firma UAT por usuarios operativos. |

## Pendientes para terminacion total del proyecto

### P0 - Cierre verificable

- `completado`: Docker Desktop y PostgreSQL saludables.
- `completado`: `pnpm db:validate`, `pnpm db:migrate:status` y `pnpm db:check` exitosos.
- `completado`: `pnpm test:e2e` exitoso en API y web.
- `completado`: archivos `.env` locales ignorados; Git solo rastrea `.env.example` y `apps/web/.env.example`.
- `completado`: lint, typecheck, pruebas, build y `git diff --check` exitosos.
- `completado`: Playwright dedicado para crear servicio, crear/configurar/activar tarifario y cotizar sin campos tenant/actor.
- Movido a P2 por corresponder a profundidad funcional: Playwright dedicado para customer imports detail, shipment detail, customs detail y transfer detail.

Puerta de aceptacion P0: todos los comandos obligatorios pasan desde el repositorio actual, las migraciones se reconocen correctamente, la base responde a los checks y los artefactos o secretos locales permanecen fuera de Git. Cualquier excepcion debe quedar registrada con causa y evidencia; no se considera aprobada por omision.

### P1 - Hardening tecnico

- `completado`: Docker multi-stage, non-root, imagenes separadas, `.env` excluido y migraciones como job unico.
- `completado`: cookies productivas Secure, CORS explicito y variables de runtime validadas.
- `completado`: backup y restauracion PostgreSQL reproducibles.
- `completado`: rate limiting de login y tracking publico.
- `completado`: readiness real con cache breve para evitar saturar dependencias bajo probes concurrentes.

### P2 - Cierre funcional por dominio

- `completado`: notificaciones/outbox con SMTP reproducible, reintentos y dead-letter.
- `completado`: almacen, carriers y estado del sistema con E2E y Playwright dedicados.
- `decision vigente`: exportaciones asincronas conservan almacenamiento temporal en PostgreSQL hasta nueva instruccion.

### P3 - Documentacion y aceptacion

- `completado`: README, despliegue, Docker, pruebas locales, backup/restore, runbook y checklist UAT.
- `pendiente externo`: ejecutar y firmar `docs/pilot-uat-checklist.md` con usuarios operativos.
- `pendiente externo`: certificar UPS/FedEx/DHL en sus sandboxes cuando existan credenciales y autorizacion.

## Recomendacion de siguiente fase

El desarrollo tecnico del alcance congelado esta cerrado. La siguiente actividad no es agregar modulos: corresponde ejecutar UAT operativa, registrar incidencias reales y certificar integraciones externas cuando se entreguen credenciales. SIGA/DGA permanece fuera de alcance hasta autorizacion oficial.
