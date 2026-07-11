# DOCUMENTO MAESTRO DE ENFOQUE DEL PROYECTO
Courier SaaS Modelo A+
Plataforma SaaS B2B multiempresa para empresas courier existentes

Campo	Valor
Versión del documento	1.1 — Consolidación de decisiones nuevas
Fecha	2026-07-09
Propósito	Definir la visión real, alcance, arquitectura, módulos y roadmap aprobado del proyecto.
Alcance	Enfoque funcional, técnico y operativo desde el Ticket 0 hasta el Ticket 45.
Principio rector	El SaaS digitaliza y controla la operación; no se convierte en courier.

Este documento reemplaza cualquier interpretación anterior que confundiera la plataforma con una empresa courier.

## 1. Resumen ejecutivo
El proyecto es una plataforma SaaS B2B multiempresa para couriers existentes. Su objetivo es digitalizar la operación, controlar los procesos, registrar evidencia, aplicar permisos y ofrecer herramientas administrativas y operativas sin asumir la responsabilidad física, comercial, logística, financiera o aduanera del courier.
El enfoque real del producto quedó consolidado alrededor de cuatro ideas: multiempresa estricta, operación courier internacional, trazabilidad completa y separación clara entre lo que registra el SaaS y lo que ejecuta físicamente cada empresa courier.

**Pilar** | **Definición**
--- | ---
**SaaS B2B** | La plataforma se vende o entrega a empresas courier existentes; no opera como courier.
**Multiempresa** | Cada courier es un tenant aislado con su propia organización, facilities, empleados, clientes, roles, tarifas, paquetes y operación.
**Operación real** | El producto cubre clientes, casilleros, prealertas, paquetes, recepción, documentos, inventario, embarques, aduanas, facturación operativa y reportes.
**Trazabilidad** | Toda mutación crítica se audita y puede generar eventos durables mediante transactional outbox.
**Backoffice** | La interfaz inicial es administrativa y operativa para empleados del courier; no es un portal del cliente final en la fase actual.

## 2. Definición oficial del producto
### 2.1 Qué es
- Una plataforma SaaS para que couriers existentes administren su operación diaria.
- Un sistema multiempresa con aislamiento por organización.
- Un backoffice para empleados, roles, permisos, clientes, casilleros, prealertas y paquetes.
- Un registro operativo confiable con auditoría, outbox y trazabilidad.
- Una base para que cada courier conserve sus reglas, códigos, facilities y responsabilidades.

### 2.2 Qué no es
- No es una empresa courier.
- No sustituye al courier ante clientes, DGA, SIGA, carriers, aduanas o proveedores.
- No asume la recepción física ni confirma entregas externas automáticamente.
- No automatiza DGA/SIGA sin autorización oficial.
- No impone un formato único de casillero a todos los couriers.
- No mezcla la facturación SaaS del proveedor con la facturación operativa del courier.

### 2.3 Responsabilidad del SaaS vs responsabilidad del courier
**Área** | **Responsabilidad del SaaS** | **Responsabilidad del courier**
--- | --- | ---
**Cliente** | Registrar clientes, códigos, direcciones, perfiles y preferencias operativas. | Validar relación comercial, soporte y cumplimiento de sus políticas.
**Paquete** | Registrar prealertas, paquetes, recepción, documentos, inventario y estados. | Manipular físicamente, inspeccionar, almacenar y entregar paquetes.
**Aduanas** | Guardar perfiles, estados, manifiestos y evidencia; preparar procesos asistidos. | Cumplir obligaciones legales y aduaneras, usar SIGA/DGA oficialmente.
**Cobros** | Calcular y registrar cargos operativos según reglas del courier. | Definir tarifas, cobrar, conciliar y responder por sus operaciones financieras.
**Seguridad** | Aplicar autenticación, permisos, auditoría, aislamiento y protección de datos. | Definir usuarios autorizados, roles internos y uso correcto del sistema.

## 3. Principios que gobiernan el proyecto
**Principio** | **Aplicación práctica**
--- | ---
**No convertir el SaaS en courier** | El sistema registra, controla y evidencia; el courier ejecuta y responde por la operación.
**Tenant primero** | Toda entidad operativa pertenece a una Organization. Recursos ajenos se tratan como no encontrados.
**Actor confiable** | organizationId, employeeId y userId se derivan de sesión o command context; nunca del body HTTP.
**Permisos dinámicos** | Roles y permisos no se guardan en cookies ni sesiones. Se evalúan desde base de datos.
**Auditoría atómica** | Dominio, AuditLog y OutboxEvent deben confirmar o revertirse juntos en mutaciones críticas.
**Sin datos sensibles innecesarios** | No guardar tokens, contraseñas, cookies, documentos completos o bodies crudos en auditoría/outbox.
**Prealerta no es recepción** | Una prealerta informa una compra esperada; no confirma que el courier tenga el paquete.
**Carrier externo no manda el estado interno** | Un estado externo puede informar, pero no sustituye la confirmación operativa del courier.
**Facility como abstracción única** | Almacenes, sucursales, agencias y puntos de retiro se modelan como Facility con tipo y capacidades.
**Roadmap controlado** | No se agregan módulos, endpoints ni tablas fuera del ticket aprobado.

## 4. Arquitectura técnica aprobada
### 4.1 Stack
**Capa** | **Tecnología / decisión**
--- | ---
**Repositorio** | pnpm + Turborepo monorepo.
**Frontend** | Next.js + React + TypeScript.
**Backend** | NestJS + TypeScript estricto.
**Base de datos** | PostgreSQL 16 Alpine.
**ORM** | Prisma 7, cliente generado en apps/api/src/generated/prisma, adapter pg.
**Arquitectura backend** | Modular monolith, no microservicios.
**Autenticación** | Sesiones opacas hash-only, cookies seguras, CSRF y CORS exacto.
**Autorización** | RBAC tenant-scoped con permisos globales versionados.
**Frontend/API** | Mismo origen público: navegador -> /backend/* -> Next.js rewrite -> NestJS.

### 4.2 Patrón de frontend/API
`Navegador -> /backend/* -> Next.js rewrite -> NestJS API -> PostgreSQL`
- El navegador no llama directamente a localhost:4000 ni a una URL privada del API.
- API_INTERNAL_URL es server-only.
- NEXT_PUBLIC_API_BASE_PATH es /backend.
- Las cookies HttpOnly y CSRF funcionan bajo el mismo host público.
- El frontend usa permisos solo para navegación y experiencia visual; NestJS sigue siendo la frontera real.

## 5. Modelo multiempresa y seguridad
### 5.1 Tenant y organizaciones
Organization es el tenant. Todo dominio operativo relevante se filtra por organizationId y las relaciones importantes usan claves compuestas tenant-safe para impedir asociaciones cruzadas incluso ante errores de aplicación.

### 5.2 Identidad, empleados y roles
**Entidad** | **Función**
--- | ---
**User** | Identidad global que puede pertenecer a una o varias organizaciones.
**Employee** | Membresía laboral de un User dentro de una Organization.
**EmployeeFacility** | Facilities donde el empleado puede operar.
**Role** | Rol configurable dentro de la organización.
**Permission** | Permiso global versionado, sincronizado por catálogo.
**EmployeeRole** | Asignación de roles por empleado.
**RolePermission** | Permisos asignados a roles.

### 5.3 Sesiones y CSRF
- Sesiones opacas con formato cs1.<secret>, almacenadas como hash SHA-256.
- Expiración absoluta de 12 horas e idle de 30 minutos.
- Rotación y detección de reutilización.
- CSRF mediante token en memoria del frontend y cookie HttpOnly del backend.
- No se guardan tokens de sesión, CSRF ni permisos en localStorage o sessionStorage.

## 6. Dominios funcionales aprobados
**Dominio** | **Enfoque aprobado**
--- | ---
**Organización** | Perfil del courier, país, moneda, zona horaria, límites y estado.
**Facilities** | Abstracción general para almacenes, sucursales, agencias y puntos operativos.
**Configuración** | Unidades, formato de fecha, estrategia de códigos de cliente, onboarding y capacidades.
**Clientes** | Personas o empresas que usan el courier. Customer no es User.
**Códigos de casillero** | customerCode único por organización, configurable, importable y no global.
**Perfil aduanero** | Documento y estado RUA separados del cliente comercial; sin ruaNumber ficticio.
**Empleados/RBAC** | Invitaciones, activación, roles, permisos, facilities permitidas y revocación scoped.
**Prealertas** | Compras esperadas: tracking externo, tienda, descripción, cantidad, valor, moneda y factura.
**Paquetes** | Unidad operativa creada por el courier con tracking interno y externo.
**Recepción** | Confirmación física posterior con mediciones y condición inicial.
**Documentos** | Facturas y fotos como metadatos seguros más almacenamiento externo.
**Inventario** | Ubicaciones, posición actual y movimientos append-only.
**Tarifas y facturación** | Tarifas versionadas, facturas operativas y pagos del courier.
**Tracking** | Consulta segura por identificadores sin exponer datos personales.
**Embarques/manifiestos/aduanas** | Procesos separados: transporte, snapshots aduaneros y gestión manual/asistida.
**Auditoría/outbox** | Evidencia humana y eventos técnicos durables para procesos posteriores.

## 7. Flujos operativos centrales
### 7.1 Flujo base de cliente y casillero
`Organization -> Facility configurada -> Customer creado/importado -> customerCode / casillero -> Perfil aduanero opcional -> Direcciones y preferencias operativas`
- El código de cliente/casillero pertenece al courier y es único dentro de su organización.
- El sistema soporta códigos heredados mediante importación controlada.
- El formato automático puede ser aleatorio o secuencial según configuración, sin romper códigos previos.

### 7.2 Flujo prealerta-paquete-recepción
`Prealerta PENDING_ARRIVAL -> Package RECEPTION_PENDING -> Recepción física RECEIVED_AT_ORIGIN -> Documentos / fotos -> Inventario / ubicación`
- Prealerta: información declarada antes de la llegada física.
- Package: registro operativo iniciado por empleado del courier.
- Recepción: confirmación física posterior con mediciones y condición.
- Inventario: ubicación física y movimientos posteriores.

### 7.3 Flujo de trazabilidad
`Mutación de negocio -> Validación tenant-safe -> Transacción PostgreSQL -> Escritura del dominio -> AuditLog -> OutboxEvent PENDING -> Commit`
La auditoría responde quién hizo qué, sobre qué entidad, cuándo y con qué cambios seguros. El outbox registra hechos técnicos confirmados para consumidores posteriores.

### 7.4 Separaciones que no deben mezclarse
**Separación** | **Regla**
--- | ---
**Prealerta vs Package** | La prealerta no es una unidad física; el Package sí es un registro operativo del courier.
**Package vs recepción** | Crear Package no confirma peso, condición, ubicación ni recepción completada.
**Carrier externo vs estado interno** | Un estado externo no cambia automáticamente el estado confirmado por el courier.
**MasterShipment vs CustomsManifest** | El primero representa transporte; el segundo es snapshot/documento aduanero.
**Transfer vs Shipment** | Transfer mueve dentro del courier; Shipment mueve internacionalmente.
**Facturación operativa vs facturación SaaS** | Cobros a clientes del courier no son cobros del proveedor SaaS.

## 8. Decisiones tomadas a partir de referencias externas
Las referencias se usaron únicamente para extraer patrones que encajan con el proyecto. No se copia arquitectura, seguridad, roles rígidos, URLs directas ni procesos que cambien el enfoque del SaaS.
**Referencia / patrón observado** | **Decisión adoptada**
--- | ---
**Registro con sucursal o punto de retiro** | Incorporar facility preferida y selector operativo cuando corresponda.
**Casillero incluido en instrucciones de dirección** | Preparar plantillas de dirección de casillero por courier.
**Rastreo por tracking externo** | Soportar búsqueda por tracking externo sin considerarlo recepción confirmada.
**Prealerta y declaración de compra** | Separar prealerta, factura/documentos y paquete físico.
**Tarifas por peso y cargos** | Crear tarifas versionadas por organización, no precios globales.
**Organización frontend por features** | Mantener rutas y componentes por dominio dentro de Next.js.
**Proxy frontend-backend** | Usar /backend same-origin, sin exponer URL interna del API.

## 9. Roadmap de tickets 0 al 45
El roadmap está organizado para construir primero la base técnica, luego el backoffice y después el ciclo operativo del courier. Cada ticket mantiene alcance cerrado y no debe ampliarse sin aprobación.
*(Tickets detallados referenciados en el documento original).*

## 10. Reglas de desarrollo y validación
### 10.1 Definition of Done por ticket
1. Plan aprobado antes de modificar archivos.
2. Migración creada con --create-only, inspeccionada y reproducible desde base vacía.
3. Relaciones tenant-safe y constraints explícitos en PostgreSQL.
4. Permisos sincronizados y sin duplicados.
5. Servicios y abstracciones sin importar Prisma; implementaciones Prisma separadas.
6. Mutaciones críticas con dominio, audit y outbox en una sola transacción.
7. Frontend usando /backend, sin enviar organizationId ni secretos.
8. Pruebas unitarias, integración, e2e y componentes cuando aplique.
9. Lint, typecheck, test, test:e2e, build y git diff --check exitosos.
10. Revisión independiente del diff y corrección de hallazgos críticos/altos/medios.

### 10.2 Comandos recurrentes
`pnpm db:format`, `pnpm db:validate`, `pnpm db:generate`, `pnpm db:migrate:status`, `pnpm db:check`, `pnpm rbac:sync-permissions`, `pnpm outbox:status`
`pnpm --filter @courier/api lint`
`pnpm --filter @courier/api typecheck`
`pnpm --filter @courier/api test`
`pnpm --filter @courier/api test:e2e`
`pnpm --filter @courier/api build`
`pnpm --filter @courier/web lint`
`pnpm --filter @courier/web typecheck`
`pnpm --filter @courier/web test`
`pnpm --filter @courier/web build`

## 11. Glosario operativo
**(Referenciar Glosario Original)**
