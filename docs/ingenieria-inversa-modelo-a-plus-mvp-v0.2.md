---
title: "Ingeniería inversa y rediseño"
subtitle: "MVP Courier SaaS · Modelo A+ v0.2"
author: "Documento técnico de planificación"
date: "23 de junio de 2026"
lang: es-DO
---

# Ficha del producto

| Elemento | Definición |
|---|---|
| Tipo de solución | Plataforma web SaaS multi-tenant para empresas de courier |
| Modelo | A+ · tenant independiente con red operativa interna |
| Frontend | Next.js + React + TypeScript |
| Backend | NestJS + TypeScript + Prisma ORM |
| Base de datos | PostgreSQL 15+ |
| Monorepo | pnpm workspaces + Turborepo |
| Contenedores | Docker y Docker Compose |
| Mercado inicial | Empresas de courier en República Dominicana |
| Versión | MVP v0.2 · base congelada para iniciar implementación |

> **Decisión central:** cada courier comprador es una `organization` aislada. Dentro de esa organización puede operar almacenes internacionales, centros de distribución, sucursales, agencias y puntos de retiro. Ningún courier comparte información operativa o financiera con otro.

# Contenido

1. Resumen ejecutivo  
2. Ingeniería inversa del producto y operación  
3. Modelo A+ y límites del dominio  
4. Arquitectura recomendada  
5. Docker, entornos y despliegue  
6. Flujo operativo principal  
7. Fortalezas del diseño  
8. Debilidades, riesgos y correcciones  
9. Análisis FODA  
10. Alcance del MVP inicial  
11. Base de datos propuesta  
12. Reglas de negocio obligatorias  
13. API mínima de NestJS  
14. Pantallas mínimas de Next.js  
15. Seguridad, confiabilidad, rendimiento y observabilidad  
16. Estrategia de pruebas  
17. Plan de implementación con Codex  
18. Roadmap y paso a producción  
19. Decisión final  

# 1. Resumen ejecutivo

El producto es una plataforma SaaS para vender a múltiples empresas de courier. Cada empresa se registra como una `organization` y funciona como tenant: sus clientes, empleados, servicios, tarifas, paquetes, facturas, pagos, ubicaciones y auditoría permanecen aislados de los demás couriers.

El componente “+” permite que cada courier administre una red interna: almacén internacional, centro de distribución en República Dominicana, sucursales propias, agencias asociadas y puntos de retiro conectados por manifiestos y transferencias.

La arquitectura conserva Next.js para la experiencia web, NestJS para la API y las reglas de negocio, Prisma para acceso a datos y PostgreSQL como fuente de verdad. El MVP se implementará como monolito modular en un monorepo y se dockerizará desde el inicio con imágenes separadas para web y API.

| Área | Valoración | Comentario |
|---|---:|---|
| Ajuste al negocio SaaS | 9/10 | Permite vender el mismo producto a couriers independientes. |
| Arquitectura | 9/10 | Separación clara entre experiencia web, dominio y persistencia. |
| Base de datos v0.2 | 8.8/10 | Servicios configurables, tracking normalizado y facturación más coherente. |
| Viabilidad del MVP | 8/10 | Viable si se construye por cortes verticales. |
| Preparación para iniciar | 9/10 | La versión v0.2 ya puede convertirse en backlog e implementación. |
| Preparación para producción | 6.5/10 | Faltan piloto, pruebas de carga, restauración y cumplimiento fiscal. |

# 2. Ingeniería inversa del producto y operación

## 2.1 Objetivo inferido

Digitalizar el ciclo operativo y financiero de una empresa de courier, desde la prealerta o recepción de un paquete hasta su traslado entre instalaciones, disponibilidad, facturación, pago, retiro y auditoría. La misma plataforma debe servir a varias empresas sin mezclar sus datos.

## 2.2 Problemas que resuelve

- Información dispersa entre hojas de cálculo, chats y registros manuales.
- Poca trazabilidad sobre quién recibió, movió, ubicó o entregó un paquete.
- Dificultad para conocer el inventario real por almacén, hub, sucursal o agencia.
- Cálculos de peso y tarifas difíciles de reproducir ante reclamaciones.
- Facturación y pagos sin relación confiable con los paquetes cobrados.
- Ausencia de un portal donde el cliente consulte tracking, saldo y facturas.
- Dificultad para vender el mismo software a varios couriers de forma segura.

## 2.3 Actores

| Actor | Responsabilidad principal |
|---|---|
| Administrador de plataforma | Crea organizations, asigna planes, suspende tenants y observa la salud global. |
| Dueño del courier | Administra configuración, facilities, servicios, tarifas y responsables. |
| Administrador del courier | Gestiona empleados, clientes, facturación, pagos y configuración. |
| Gerente de operaciones | Supervisa recepción, inventario, manifiestos y discrepancias. |
| Gerente de facility | Controla una o varias instalaciones autorizadas. |
| Recepción / almacén | Recibe, pesa, mide, etiqueta, ubica y escanea paquetes. |
| Cajero | Emite facturas, registra pagos y autoriza retiros. |
| Servicio al cliente | Consulta trazabilidad e incidencias sin permisos financieros sensibles. |
| Cliente | Prealerta paquetes y consulta tracking, facturas, pagos y perfil. |

## 2.4 Módulos reconstruidos

1. Control de plataforma y organizations.
2. Autenticación, sesiones y contexto de tenant.
3. Facilities y ubicaciones físicas.
4. Empleados, roles básicos y asignaciones.
5. Clientes y casilleros.
6. Carriers y servicios configurables.
7. Prealerta, recepción, inventario y tracking.
8. Transferencias y manifiestos entre facilities.
9. Tarifas, peso cobrable y facturación.
10. Pagos parciales, saldos y retiro.
11. Auditoría, logs, métricas y despliegue.

# 3. Modelo A+ y límites del dominio

![Modelo de tenencia A+](assets/tenancy.png)

## 3.1 Jerarquía

```text
PLATFORM
└── ORGANIZATIONS
    ├── FACILITIES
    │   ├── INTERNATIONAL_WAREHOUSE
    │   ├── DISTRIBUTION_CENTER
    │   ├── BRANCH
    │   ├── AGENCY
    │   └── PICKUP_POINT
    ├── EMPLOYEES
    ├── CUSTOMERS
    ├── CARRIERS
    ├── SERVICES
    ├── PACKAGES
    ├── TRANSFERS
    ├── RATE_RULES
    ├── INVOICES
    └── PAYMENTS
```

## 3.2 Límites

| Elemento | Entre facilities del mismo courier | Entre couriers distintos |
|---|---|---|
| Paquetes | Pueden transferirse por manifiesto. | Nunca se transfieren en el MVP. |
| Clientes | Pertenecen a la organization y tienen facility preferida. | No se comparten. |
| Empleados | Pueden asignarse a varias facilities. | No se comparten. |
| Servicios y tarifas | Pueden ser generales o específicas de facility. | No se comparten. |
| Facturas y pagos | Se consolidan dentro del courier. | Aislamiento total. |
| Configuración | Marca, moneda, medición y prefijos comunes. | Configuración independiente. |

## 3.3 Fuera del MVP

- Liquidaciones y comisiones entre el courier y agencias o franquiciados.
- Transferencias comerciales entre dos organizations.
- Permisos completamente configurables.
- Facturación automática de la suscripción SaaS.
- Última milla con conductores, rutas, foto y firma.
- Reembolsos parciales y contabilidad general.

> `organization_id` se deriva del dominio o subdominio y de la identidad autenticada. Nunca se acepta como autoridad un identificador enviado libremente por el navegador.

# 4. Arquitectura recomendada

![Arquitectura de aplicaciones y datos](assets/architecture.png)

## 4.1 Decisión arquitectónica

Se recomienda un monorepo con dos aplicaciones desplegables: Next.js para la experiencia pública y privada, y NestJS como única API propietaria de las reglas de negocio. PostgreSQL conserva integridad y Prisma se utiliza exclusivamente desde la API.

No se recomiendan microservicios durante el MVP. El backend será un monolito modular: una aplicación desplegable, separada internamente por dominios.

## 4.2 Responsabilidades de Next.js

- Página pública del SaaS y sitio white-label de cada courier.
- Tracking público limitado por organization y código.
- Registro, inicio de sesión y recuperación de acceso.
- Portal del cliente y backoffice.
- Formularios, tablas, escaneo y estados de interfaz.
- Renderizado inicial, metadata y manejo de errores.

## 4.3 Responsabilidades de NestJS

- Autenticación, rotación de sesiones y autorización real.
- Resolución obligatoria de `organization_id` y facilities permitidas.
- Transiciones de paquetes, transferencias y auditoría.
- Cálculo de peso volumétrico, peso cobrable y tarifas.
- Emisión de facturas, pagos, asignaciones y transacciones.
- Integridad entre tenant, facility, cliente, carrier, servicio y paquete.

## 4.4 Monorepo definitivo

```text
courier-saas/
├── apps/
│   ├── web/                         # Next.js
│   └── api/                         # NestJS + Prisma
│       └── prisma/
│           ├── schema.prisma
│           ├── migrations/
│           └── seed.ts
├── packages/
│   ├── contracts/                   # Tipos y contratos compartidos
│   ├── ui/
│   ├── eslint-config/
│   └── typescript-config/
├── docs/
│   ├── implementation-plan.md
│   ├── development.md
│   ├── docker.md
│   ├── deployment.md
│   ├── database.md
│   └── adr/
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── compose.dev.yml
├── compose.prod.yml
├── AGENTS.md
├── .env.example
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

> Next.js no importa Prisma Client ni servicios de NestJS. Toda mutación operativa o financiera pasa por la API.

# 5. Docker, entornos y despliegue

## 5.1 Estrategia de desarrollo

La modalidad principal será híbrida:

```text
Next.js local + NestJS local + PostgreSQL en Docker
```

Esto conserva hot reload y depuración rápida, mientras la base de datos permanece reproducible. Una modalidad completamente dockerizada se utilizará para integración, CI y verificación de paridad.

Comando esperado:

```bash
docker compose -f compose.dev.yml up -d postgres
pnpm install
pnpm dev
```

## 5.2 Imágenes de producción

Se construirán imágenes independientes:

- `courier-web`: Next.js con salida `standalone`.
- `courier-api`: NestJS compilado, Prisma Client generado y usuario no root.

Ambas imágenes serán multi-stage, no copiarán archivos `.env` y tendrán healthchecks. PostgreSQL de producción será administrado; no se alojará en el mismo contenedor de la aplicación.

## 5.3 Migraciones

- Desarrollo: `prisma migrate dev`.
- Producción: `prisma migrate deploy`.
- No utilizar `prisma db push` para producción.
- Las migraciones se ejecutan como trabajo único antes de desplegar nuevas réplicas.
- Funciones, vistas, triggers y restricciones específicas de PostgreSQL se conservan como SQL dentro de migraciones versionadas.

## 5.4 Variables y red

El navegador utiliza una URL pública, mientras Next.js dentro de Docker puede utilizar el nombre interno del servicio:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
API_INTERNAL_URL=http://api:4000
```

Los secretos se inyectan en tiempo de ejecución y nunca se incorporan a las imágenes.

# 6. Flujo operativo principal

![Flujo principal de estados](assets/package_flow.png)

## 6.1 Corte vertical inicial

```text
Crear organization
  → Crear facility
  → Crear carrier UNKNOWN y servicios iniciales
  → Registrar cliente
  → Crear o recibir paquete
  → Pesar y medir
  → Asignar ubicación
  → Cambiar estado con historial
  → Consultar tracking público
```

Este flujo debe funcionar de principio a fin antes de añadir facturación avanzada, integraciones o reportes.

## 6.2 Flujo ampliado

1. El cliente recibe un casillero único dentro del courier.
2. Crea una prealerta opcional.
3. El personal confirma carrier, servicio y tracking.
4. El sistema normaliza el tracking y evita duplicados dentro del mismo carrier.
5. Se registran peso, dimensiones, sistema de medición y divisor.
6. El paquete se ubica o se agrega a un manifiesto.
7. La facility destino lo recibe y registra discrepancias.
8. El paquete pasa a `AVAILABLE` con ubicación física.
9. Se genera factura, se registra pago y se retira.
10. Cada acción sensible queda auditada.

# 7. Fortalezas del diseño

| Fortaleza | Valor |
|---|---|
| Modelo comercial coherente | Cada courier es un tenant vendible de forma independiente. |
| Facilities flexibles | Representan almacenes, hubs, sucursales, agencias y puntos. |
| Servicios configurables | Cada courier define su catálogo sin migraciones de código. |
| Trazabilidad | Estado actual, eventos inmutables y auditoría. |
| Integridad multi-tenant | Claves compuestas y filtros obligatorios. |
| Facturación histórica | Snapshot del cliente, líneas inmutables y numeración transaccional. |
| Pagos parciales | Pagos y asignaciones separados. |
| Docker desde el inicio | Entornos repetibles y camino claro a staging/producción. |
| Stack TypeScript | Contratos compartidos y menor fricción entre web y API. |

# 8. Debilidades, riesgos y correcciones

## 8.1 Fuga entre tenants

**Riesgo:** una consulta sin `organization_id` puede revelar información de otro courier.  
**Corrección:** contexto de tenant centralizado, repositorios obligatorios, claves compuestas, pruebas de aislamiento y RLS posterior.

## 8.2 Alcance amplio

**Riesgo:** desarrollar muchos módulos incompletos.  
**Corrección:** cortes verticales con criterios de aceptación y commits pequeños.

## 8.3 Tarifas complejas

**Riesgo:** solapamientos y resultados ambiguos.  
**Corrección:** `services`, prioridad de facility, rangos no solapados, vigencia y pruebas de borde.

## 8.4 Concurrencia financiera

**Riesgo:** sobrepago o numeración duplicada.  
**Corrección:** transacciones, `SELECT FOR UPDATE`, idempotencia y pruebas concurrentes.

## 8.5 Operación con Internet inestable

**Riesgo:** escaneo lento o interrupciones en almacén.  
**Corrección:** interfaz ligera, reintentos idempotentes y PWA offline limitada en una fase posterior.

## 8.6 Cumplimiento fiscal pendiente

**Riesgo:** la factura técnica puede no satisfacer requisitos tributarios locales.  
**Corrección:** validar numeración y comprobantes fiscales antes del piloto comercial con cobros reales.

## 8.7 Complejidad Docker prematura

**Riesgo:** fricción de hot reload en Windows.  
**Corrección:** desarrollo híbrido; Docker completo para integración y despliegue.

# 9. Análisis FODA

| Fortalezas | Oportunidades |
|---|---|
| Arquitectura modular y mantenible. | SaaS white-label para couriers pequeños y medianos. |
| Aislamiento por organization. | Planes por usuarios, facilities o volumen. |
| Servicios y facilities configurables. | PWA de recepción y almacén. |
| Facturación, pagos y auditoría. | Integraciones con carriers y comercio electrónico. |
| Contenedores separados y despliegue reproducible. | Expansión posterior a última milla. |

| Debilidades | Amenazas |
|---|---|
| MVP todavía considerable. | Una fuga multi-tenant dañaría la confianza. |
| Reglas financieras requieren disciplina transaccional. | Mala experiencia de escaneo puede impedir adopción. |
| Facturación del SaaS no incluida. | Requisitos fiscales no validados. |
| Identidad global debe proteger privacidad entre couriers. | Personalizaciones excesivas por cliente. |
| RLS queda para fase posterior. | Crecimiento del alcance antes del piloto. |

# 10. Alcance del MVP inicial

## 10.1 Debe incluir

- Provisionamiento manual de organizations.
- Facilities, empleados y asignaciones.
- Usuarios, sesiones revocables y contexto de tenant.
- Clientes y casilleros.
- Carriers normalizados y servicios configurables.
- Prealerta, recepción, peso, dimensiones y etiqueta.
- Tracking público e historial.
- Ubicación física e inventario.
- Transferencias y discrepancias.
- Tarifas, facturas, pagos parciales y retiro.
- Auditoría, healthchecks, logs y backups.
- Dockerfiles y Compose para desarrollo e integración.

## 10.2 Fuera inicialmente

- Autoservicio de suscripción y cobro del SaaS.
- Aplicación móvil nativa.
- WhatsApp y SMS automáticos.
- Optimización de rutas.
- Firma, fotografía y geolocalización.
- Integraciones con todos los carriers.
- Contabilidad general y reembolsos parciales.
- Permisos completamente configurables.
- Analítica predictiva.

# 11. Base de datos propuesta

El esquema v0.2 contiene **21 tablas**. El aislamiento se realiza con `organization_id`, claves compuestas, autorización en NestJS y pruebas automatizadas. PostgreSQL administra integridad, rangos de tarifas, secuencias, vistas y triggers.

![Relaciones principales](assets/er_high.png)

## 11.1 Catálogo de tablas

| # | Tabla | Propósito |
|---:|---|---|
| 1 | organizations | Tenant, marca, moneda, medición, plan y estado. |
| 2 | facilities | Almacenes, hubs, sucursales, agencias y puntos. |
| 3 | users | Identidad global y credenciales. |
| 4 | user_sessions | Sesiones revocables y tenant activo. |
| 5 | employees | Empleado y rol dentro de la organization. |
| 6 | employee_facilities | Asignaciones a una o varias facilities. |
| 7 | customers | Cliente, casillero y facility preferida. |
| 8 | storage_locations | Zona, rack o estante. |
| 9 | carriers | Transportistas normalizados y carrier UNKNOWN. |
| 10 | services | Servicios configurables por courier. |
| 11 | packages | Tracking, medidas, servicio, estado y ubicación. |
| 12 | package_events | Historial inmutable público/privado. |
| 13 | transfers | Cabecera de manifiesto. |
| 14 | transfer_items | Paquetes y escaneos del manifiesto. |
| 15 | rate_rules | Tarifas por servicio, facility, peso y vigencia. |
| 16 | document_sequences | Numeración concurrente. |
| 17 | invoices | Snapshot del cliente, totales y estado. |
| 18 | invoice_items | Conceptos históricos facturados. |
| 19 | payments | Pagos pendientes, confirmados o anulados. |
| 20 | payment_allocations | Distribución entre facturas. |
| 21 | audit_logs | Acciones sensibles append-only. |

## 11.2 Cambios de la versión v0.2

- Se reemplaza el enum rígido de servicio por `services`.
- `carrier_id` es obligatorio; cuando se desconoce se utiliza `UNKNOWN`.
- El tracking se normaliza antes de validar unicidad.
- `organization.status` es la única autoridad de habilitación del tenant.
- `TAX` y `DISCOUNT` se eliminan de los tipos de línea.
- Reembolsos quedan fuera del MVP.
- Las líneas de factura se bloquean al emitir.
- Las tarifas solapadas se rechazan mediante una exclusión GiST.
- Las migraciones Prisma incorporan SQL específico de PostgreSQL.

## 11.3 Decisiones financieras

- El dinero se almacena en unidades menores con `bigint`.
- Una factura `DRAFT` no consume número.
- El total es `subtotal - descuento + impuesto`.
- Pago y factura deben compartir organization, cliente y moneda.
- La asignación usa bloqueos y recalcula saldos dentro de la transacción.

# 12. Reglas de negocio obligatorias

1. Toda entidad operativa pertenece a una organization.
2. El tenant se deriva del host y de la sesión.
3. `SUSPENDED` y `CANCELLED` bloquean operaciones.
4. Un cliente tiene casillero único dentro de su organization.
5. Cada organization dispone de un carrier `UNKNOWN`.
6. Los servicios son configurables y no se comparten entre couriers.
7. El tracking normalizado es único por organization y carrier.
8. El peso cobrable es el mayor entre real y volumétrico.
9. Las dimensiones están todas presentes o todas ausentes.
10. Cambio de estado y evento se guardan en la misma transacción.
11. `AVAILABLE` exige facility y ubicación física.
12. Una transferencia no tiene el mismo origen y destino.
13. Un paquete no aparece dos veces en un manifiesto.
14. Las tarifas no se solapan dentro del mismo alcance.
15. Una factura emitida no permite modificar sus líneas.
16. `TAX` y `DISCOUNT` existen solo en la cabecera.
17. La numeración se asigna al emitir.
18. Un pago empieza en `PENDING` y requiere confirmación.
19. Una asignación no excede pago confirmado ni saldo.
20. `package_events` y `audit_logs` son append-only.
21. Toda consulta administrativa filtra por organization.
22. Las migraciones se ejecutan una sola vez por despliegue.

# 13. API mínima de NestJS

| Método | Endpoint | Función |
|---|---|---|
| GET | /health | Salud de la API y dependencias básicas. |
| POST | /auth/login | Crear sesión dentro del tenant. |
| POST | /auth/refresh | Rotar refresh token. |
| POST | /auth/logout | Revocar sesión. |
| GET | /me | Usuario, organization, rol y facilities. |
| POST | /platform/organizations | Provisionar courier. |
| POST | /facilities | Crear instalación. |
| POST | /employees | Crear empleado y asignaciones. |
| POST | /customers | Registrar cliente y casillero. |
| POST | /carriers | Crear transportista. |
| POST | /services | Crear servicio configurable. |
| POST | /packages/pre-alerts | Crear prealerta. |
| POST | /packages/receive | Recibir, pesar, medir y etiquetar. |
| PATCH | /packages/:id/status | Cambiar estado con historial. |
| PATCH | /packages/:id/location | Asignar ubicación. |
| GET | /public/:org/tracking/:code | Tracking público limitado. |
| POST | /transfers | Crear manifiesto. |
| POST | /transfers/:id/dispatch | Despachar. |
| POST | /transfers/:id/receive | Recibir y detectar discrepancias. |
| GET | /rates/quote | Cotizar tarifa aplicada. |
| POST | /invoices | Crear borrador. |
| POST | /invoices/:id/issue | Emitir y numerar. |
| POST | /payments | Registrar pago pendiente. |
| POST | /payments/:id/confirm | Confirmar pago. |
| POST | /payments/:id/allocate | Aplicar pago a facturas. |
| GET | /dashboard/summary | Resumen del tenant. |

## 13.1 Convenciones

- DTOs validados y transformación explícita.
- `request_id` en respuesta y logs.
- Errores de dominio con códigos estables.
- Paginación en listados.
- `Idempotency-Key` en pagos, recepción y escaneos.
- Tracking público sin notas privadas.

# 14. Pantallas mínimas de Next.js

| Área | Pantallas |
|---|---|
| Público del SaaS | Inicio, características, planes, contacto y login. |
| Público del courier | Marca, tracking, facilities y registro. |
| Portal del cliente | Resumen, paquetes, prealerta, facturas, saldo y perfil. |
| Operación | Dashboard, recepción, inventario, detalle, transferencias y ubicaciones. |
| Comercial | Clientes, servicios, tarifas, facturas, pagos y empleados. |
| Configuración | Organization, marca, medición, prefijos, facilities y carriers. |
| Plataforma | Organizations, plan, estado, límites y auditoría limitada. |

Los Server Components se usan para carga inicial y vistas de lectura. Los Client Components se reservan para escáner, formularios, modales y APIs del navegador. Datos operativos, facturas y pagos no utilizan caché compartida.

# 15. Seguridad, confiabilidad, rendimiento y observabilidad

## 15.1 Seguridad

- Argon2id o bcrypt para contraseñas.
- Cookies HttpOnly, Secure y SameSite.
- Rotación y revocación de refresh tokens.
- Guards por organization, rol y facility.
- Rate limiting en login y tracking.
- CORS limitado y protección CSRF cuando aplique.
- Secretos fuera del repositorio y de las imágenes.
- Contenedores no root.

## 15.2 Confiabilidad

- Transacciones en estados, facturación y pagos.
- Idempotencia en pagos y escaneos.
- Backups automáticos y pruebas de restauración.
- Migraciones versionadas.
- Healthchecks para web, API y dependencias.
- Despliegues con rollback documentado.

## 15.3 Rendimiento

- Índices por organization, tracking, facility, estado, cliente y fecha.
- Paginación y carga diferida de historiales.
- Pool de conexiones compatible con el proveedor.
- Medición de consultas lentas antes de optimizar.
- Next.js `standalone` y caché solo para contenido público seguro.

## 15.4 Observabilidad

- Logs estructurados de web y API.
- `request_id` correlacionado.
- Métricas de latencia, errores, conexiones y colas futuras.
- Alertas por fallos de recepción, pagos, migraciones y backups.
- Auditoría de exportaciones y cambios sensibles.

# 16. Estrategia de pruebas

## 16.1 Unitarias

- Peso volumétrico y cobrable.
- Normalización de tracking.
- Transiciones de paquetes.
- Selección y redondeo de tarifas.
- Totales de factura.
- Reglas de estado de pago.

## 16.2 Integración

- Cambio de estado más evento en una transacción.
- Aislamiento entre organizations.
- Tarifa general frente a tarifa específica.
- Rechazo de rangos solapados.
- Emisión concurrente de números.
- Pago parcial, bloqueo y saldo.
- Inmutabilidad de invoice_items emitidos.

## 16.3 End-to-end

1. Provisionar organization.
2. Crear facility, carrier y servicio.
3. Registrar cliente.
4. Crear prealerta.
5. Recibir y ubicar paquete.
6. Transferirlo a otra facility.
7. Marcarlo disponible.
8. Emitir factura.
9. Confirmar y asignar pago.
10. Retirar paquete y consultar tracking.

## 16.4 Prueba crítica de seguridad

Crear dos organizations con identificadores similares y comprobar que ningún endpoint, exportación, relación, error o log de usuario expone datos del tenant contrario.

# 17. Plan de implementación con Codex

## 17.1 Forma de trabajo

```text
Planificar → implementar una tarea pequeña → ejecutar pruebas
→ revisar diff → corregir → commit → siguiente tarea
```

Codex debe leer `AGENTS.md` y los documentos de `docs/` antes de modificar código. No se le debe pedir construir el sistema completo en una sola instrucción.

## 17.2 Fases

| Fase | Resultado verificable |
|---|---|
| 0 · Infraestructura | Monorepo, PostgreSQL Docker, health, lint, tipos, pruebas y build. |
| 1 · Tenant y auth | Organizations, sesiones, empleados, facilities y aislamiento. |
| 2 · Primer corte vertical | Cliente, carrier, servicio, paquete, ubicación, estado y tracking. |
| 3 · Red interna | Transferencias, escaneos y discrepancias. |
| 4 · Monetización operativa | Tarifas, facturas, pagos, saldos y retiro. |
| 5 · Portal y piloto | Portal, backoffice, etiquetas, importación y capacitación. |

## 17.3 Definición de terminado

Una tarea está terminada cuando cumple criterios de aceptación, incluye pruebas, mantiene aislamiento, pasa lint/tipos/test/build y actualiza documentación pertinente.

# 18. Roadmap y paso a producción

![Flujo de despliegue](assets/deployment.png)

## 18.1 Roadmap

| Fase | Contenido |
|---|---|
| Descubrimiento | Validar operación real con 1–2 couriers. |
| Fundamentos | Monorepo, Docker, PostgreSQL, Prisma, CI y observabilidad. |
| Núcleo SaaS | Organizations, facilities, auth y empleados. |
| Operación | Clientes, servicios, paquetes, inventario y tracking. |
| Red interna | Manifiestos y transferencias. |
| Finanzas | Tarifas, facturas, pagos y retiro. |
| Piloto | Migración inicial, capacitación y métricas. |
| Automatización | Correo, PWA, importaciones e integraciones. |
| Expansión | RLS, permisos dinámicos, agencias y última milla. |

## 18.2 Secuencia de despliegue

```text
Backup o snapshot
  → prisma migrate deploy
  → desplegar API
  → desplegar web
  → verificar healthchecks
  → ejecutar smoke tests
  → monitorear errores y latencia
```

## 18.3 Criterios para producción

- Aislamiento multi-tenant aprobado.
- Restauración de backup comprobada.
- Concurrencia de facturación y pagos validada.
- Recepción y escaneo con tiempos aceptables.
- Auditoría suficiente para reconstruir operaciones.
- Políticas de privacidad, retención y soporte definidas.
- Cumplimiento fiscal validado.
- Staging equivalente a producción.

# 19. Decisión final

El Modelo A+ v0.2 es una base sólida para iniciar el desarrollo de un SaaS de courier en República Dominicana. Cada empresa es un tenant aislado y puede administrar una red interna de facilities sin reconstruir el dominio.

La combinación Next.js, NestJS, Prisma, PostgreSQL, pnpm, Turborepo y Docker es equilibrada. Permite desarrollar rápido, mantener reglas críticas en un backend transaccional y preparar despliegues reproducibles sin introducir microservicios.

La versión v0.2 cierra las decisiones pendientes más importantes: servicios configurables, tracking normalizado, estado único de organization, líneas de factura coherentes, pagos simplificados, protección posterior a emisión y estrategia Docker.

> **Recomendación ejecutiva:** congelar esta versión como línea base, iniciar la Fase 0 y construir primero el corte vertical desde organization hasta tracking. Reducir funciones es aceptable; debilitar aislamiento, trazabilidad o integridad financiera no lo es.

# Entregables asociados

- Documento DOCX y Markdown de ingeniería inversa v0.2.
- Esquema PostgreSQL v0.2.
- Guías de desarrollo, Docker, despliegue y base de datos.
- `AGENTS.md` para trabajar con Codex.
- ADRs de las decisiones arquitectónicas principales.
- Plantillas iniciales de Docker Compose y variables de entorno.
