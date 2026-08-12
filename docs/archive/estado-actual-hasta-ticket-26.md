# Estado actual del sistema hasta Ticket 26

Fecha de corte: 2026-07-07
Repositorio: `D:\Cursos\Projects\Courier`
Base integrada actual: `main`
Ultimo ticket integrado: Ticket 26 (`feat(packages): add package reception workflow`)

## 1. Resumen ejecutivo

El sistema ya no esta en fase de bootstrap. A la fecha existe un monorepo funcional con:

- `apps/web`: backoffice inicial en Next.js.
- `apps/api`: API NestJS con Prisma y PostgreSQL.
- PostgreSQL 16 para desarrollo local via Docker Compose.
- Autenticacion HTTP con cookies, CSRF y sesiones persistentes.
- RBAC multi-tenant por organizacion.
- Auditoria inmutable y transactional outbox.
- Modulos operativos iniciales para organizaciones, facilities, empleados, clientes, prealertas y paquetes.
- Flujo operativo implementado hasta recepcion fisica de paquetes en origin facility.

El alcance implementado cubre la base multi-tenant del courier y el inicio del flujo operativo:

1. Identidad y membresia.
2. Roles y permisos.
3. Organizacion y facilities.
4. Onboarding inicial.
5. Clientes y perfil aduanero.
6. Prealertas.
7. Registro de paquetes.
8. Matching prealerta <-> paquete.
9. Recepcion fisica y mediciones del paquete.

Todavia no estan implementados los tickets 27 al 45, incluyendo documentos del paquete, inventario, escaneo, tracking publico, billing, manifests, integraciones externas y hardening final del piloto.

## 2. Arquitectura actual

### 2.1 Stack

- Monorepo con `pnpm` + `Turborepo`
- Frontend: Next.js 16 + React 19 + TypeScript
- Backend: NestJS 11 + TypeScript estricto
- ORM / acceso a datos: Prisma 7
- Base de datos: PostgreSQL
- Desarrollo local DB: Docker Compose con `postgres:16-alpine`
- Testing:
  - API: Jest unit + e2e
  - Web: Vitest + Playwright

### 2.2 Principios ya visibles en el codigo

- Monolito modular, no microservicios.
- PostgreSQL es la fuente de verdad.
- NestJS concentra reglas de negocio.
- Next.js no accede directo a base de datos.
- Multi-tenancy por `organizationId`.
- Tenant y actor derivados de sesion, no del navegador.
- Recursos de otra organizacion se manejan como no encontrados.
- Mutaciones criticas con transaccion, auditoria y outbox atomicos.

## 3. Estado del monorepo

Estructura principal actual:

```text
courier/
|-- apps/
|   |-- api/
|   `-- web/
|-- docs/
|-- package.json
|-- pnpm-workspace.yaml
|-- turbo.json
|-- compose.dev.yml
|-- compose.prod.yml
|-- README.md
`-- AGENTS.md
```

Scripts raiz relevantes:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm db:up`
- `pnpm db:status`
- `pnpm db:format`
- `pnpm db:validate`
- `pnpm db:generate`
- `pnpm db:check`
- `pnpm db:migrate:dev`
- `pnpm db:migrate:status`
- `pnpm rbac:sync-permissions`
- `pnpm outbox:status`

## 4. Tickets ya implementados

Resumen por hitos integrados en `main`:

1. Bootstrap de workspace `pnpm` + `turbo`
2. `apps/web` con Next.js
3. `apps/api` con NestJS y `GET /health`
4. PostgreSQL local con Docker Compose
5. Prisma configurado y conectado
6. Esquema inicial de `organizations` y `facilities`
7. Integracion de Prisma en NestJS
8. Nucleo de `organizations`
9. Identidad, empleados, acceso a facilities y sesiones
10. Esquema RBAC multi-tenant
11. Nucleo RBAC en NestJS
12. Invitacion y activacion segura de cuentas
13. Autenticacion interna y seleccion de organizacion
14. Sesiones persistentes con rotacion y revocacion
15. Autenticacion HTTP con cookies seguras
16. Autorizacion HTTP por permisos efectivos
17. Endpoints administrativos de organizaciones y facilities
18. Clientes, direcciones y perfil aduanero / RUA
19. Administracion de empleados, roles, facilities y revocacion
20. Configuracion operativa, onboarding y migracion controlada de clientes
21. Backoffice inicial en Next.js
22. Auditoria inmutable y transactional outbox
23. Prealertas y paquetes esperados
24. Paquetes e identificadores operativos
25. Recepcion fisica y mediciones del paquete

Nota: el repositorio usa numbering por tickets de trabajo, pero varios commits consolidan mas de un subpaso tecnico dentro del mismo hito.

## 5. Base de datos y Prisma

### 5.1 Estado general

El esquema Prisma ya modela una parte importante del dominio MVP inicial:

- `Organization`
- `Facility`
- `Account`
- `UserMembership`
- `Employee`
- `Role`
- `Permission`
- `RolePermission`
- `EmployeeRole`
- `EmployeeFacility`
- `UserSession`
- `LoginChallenge`
- `Customer`
- `CustomerAddress`
- `CustomerCustomsProfile`
- `OrganizationSettings`
- `CustomerImportJob`
- `CustomerImportRow`
- `AuditLog`
- `OutboxEvent`
- `Prealert`
- `Package`
- `PackageReception`

Tambien existen enums operativos y de seguridad para estados, unidades, permisos y control de sesiones.

### 5.2 Estado operativo ya implementado

El flujo operativo llega hasta:

- prealerta esperada
- registro de paquete
- asignacion / matching con prealerta
- recepcion fisica con snapshot de:
  - facility
  - empleado receptor
  - peso
  - dimensiones
  - piezas
  - condicion
  - timestamp

### 5.3 Migraciones

Hay migraciones versionadas acumuladas desde la inicializacion del dominio hasta Ticket 26.

Migraciones de mayor impacto ya presentes:

- init `organizations` / `facilities`
- identidad y membresia
- RBAC multi-tenant
- activacion de usuarios
- sesiones persistentes
- clientes y customs profiles
- organization settings e importacion de clientes
- audit logs y outbox
- prealertas
- package identifiers
- package reception

No se ha modelado todavia inventario, documentos, billing, tracking publico, manifiestos, integraciones o notificaciones finales.

## 6. Backend API

### 6.1 Modulos existentes

En `apps/api/src` ya existen modulos funcionales para:

- `health`
- `auth`
- `accounts`
- `sessions`
- `rbac`
- `organizations`
- `organization-settings`
- `facilities`
- `employees`
- `customers`
- `customer-imports`
- `audit`
- `outbox`
- `prealerts`
- `packages`
- `prisma`
- `request-context`

### 6.2 Capacidades backend ya implementadas

#### Salud y base tecnica

- `GET /health`
- Prisma integrado al ciclo de vida de NestJS
- DTO validation
- guards y decorators para autenticacion / autorizacion
- manejo de request context

#### Auth / seguridad

- login interno con credenciales
- activacion segura de cuentas
- cookies HttpOnly
- proteccion CSRF
- seleccion de organizacion
- sesiones persistentes
- rotacion / revocacion de sesiones
- proteccion por permisos efectivos

#### Organizacion / operaciones base

- ver y actualizar organizacion actual
- ver y actualizar settings de organizacion
- onboarding y capabilities
- CRUD administrativo inicial de facilities
- administracion de empleados y asignaciones
- administracion de roles y permisos

#### Clientes

- CRUD base de clientes
- multiples direcciones
- perfil aduanero / verificacion
- importacion controlada de clientes con staging

#### Prealertas

- crear prealerta
- listar / ver detalle
- actualizar
- cancelar

#### Paquetes

- crear paquete
- listar / ver detalle
- actualizar
- cancelar
- matching inicial con prealerta
- recepcion fisica (`POST /packages/:packageId/receive`)
- consulta de recepcion (`GET /packages/:packageId/reception`)

### 6.3 Ticket 26 ya integrado

Lo mas nuevo del backend es el flujo de recepcion:

- solo permitido para paquete en estado `RECEPTION_PENDING`
- valida facility activa de origen asignada al empleado autenticado
- bloquea idempotencia conflictiva
- snapshot inmutable de mediciones
- transaccion unica para:
  - crear recepcion
  - mover estado del paquete a `RECEIVED_AT_ORIGIN`
  - escribir auditoria
  - escribir outbox

## 7. Frontend web

### 7.1 Estado general

`apps/web` ya no es un simple bootstrap. Existe un backoffice funcional, aunque todavia inicial.

### 7.2 Pantallas ya presentes

Rutas principales visibles en `src/app`:

- `/login`
- `/activate`
- `/dashboard`
- `/organization`
- `/onboarding`
- `/facilities`
- `/employees`
- `/employees/:employeeId`
- `/roles`
- `/roles/:roleId`
- `/customers`
- `/customers/:customerId`
- `/customer-imports`
- `/customer-imports/:importId`
- `/prealerts`
- `/prealerts/new`
- `/prealerts/:prealertId`
- `/packages`
- `/packages/new`
- `/packages/:packageId`
- `/packages/:packageId/receive`

### 7.3 Comportamiento frontend ya implementado

- sesion basada en cookies
- integracion CSRF
- cliente HTTP hacia `/backend/*`
- provider de autenticacion
- boundaries por permisos
- vistas administrativas iniciales para las entidades centrales
- formularios de prealerta, clientes, paquetes y recepcion

### 7.4 Limitaciones actuales del frontend

- no hay UX avanzada para warehouse scanning
- no hay inventario visual
- no hay documentos / fotos del paquete
- no hay tracking publico
- no hay billing ni pagos
- no hay reporteria

## 8. Multi-tenancy y seguridad

Los principios clave ya estan implementados en varias capas:

- tenant derivado de sesion / contexto autenticado
- consultas administrativas filtradas por `organizationId`
- acceso cruzado tratado como `404`
- frontend no manda `organizationId` para mutaciones administrativas
- permisos efectivos evaluados en backend
- cookies seguras y CSRF para auth HTTP
- datos sensibles excluidos de listados donde no deben salir

## 9. Auditoria y outbox

Ya existe infraestructura para:

- auditoria inmutable
- snapshots sanitizados
- transactional outbox
- consulta de estado resumido de outbox

Esto ya se usa en flujos operativos recientes, incluyendo recepcion de paquetes.

Todavia no existe el conjunto completo de consumidores y notificaciones que explotaran ese outbox en tickets posteriores.

## 10. Docker y desarrollo local

Para desarrollo local ya existe:

- `compose.dev.yml` con PostgreSQL 16
- volumen persistente
- `healthcheck`
- `.env.example`
- comandos `db:*` en raiz

La aplicacion web y la API se siguen ejecutando localmente fuera de contenedores.

## 11. Testing y validacion

El repositorio ya incluye cobertura automatizada relevante:

- unit tests backend
- e2e backend con PostgreSQL real
- unit / component tests frontend
- e2e frontend con Playwright

Antes de cerrar Ticket 26 se validaron en verde:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm build`
- `git diff --check`

Tambien quedaron verdes los comandos de base de datos usados en el flujo reciente:

- `pnpm db:format`
- `pnpm db:validate`
- `pnpm db:generate`
- `pnpm db:migrate:status`
- `pnpm db:check`
- `pnpm rbac:sync-permissions`
- `pnpm outbox:status`

## 12. Que NO esta implementado todavia

Pendiente a partir del Ticket 27:

- documentos del paquete, facturas y fotografias
- inventario y ubicaciones
- interfaz de almacen y escaneo
- servicios y tarifas
- billing operativo y pagos
- pickup requests
- tracking publico limitado
- master shipments
- HAWB / MAWB / consolidaciones
- manifiestos aduaneros
- gestion aduanera asistida
- retenciones / incidencias / correcciones
- transferencias entre facilities
- entrega final
- notificaciones transaccionales
- integraciones con carriers
- integracion con SIGA
- reportes / exportaciones
- hardening final del piloto

## 13. Riesgos y puntos de revision recomendados

Estas son las areas donde conviene que Gemini Pro critique con mas profundidad:

### 13.1 Arquitectura y limites modulares

- Si la separacion entre modulos NestJS sigue siendo clara o ya empieza a haber demasiado acoplamiento entre `auth`, `rbac`, `organizations`, `employees`, `prealerts` y `packages`.
- Si las reglas de negocio estan quedando correctamente encapsuladas en servicios / repositorios.

### 13.2 Multi-tenancy real

- Si todas las consultas y mutaciones sensibles filtran correctamente por `organizationId`.
- Si hay algun vector donde el frontend o el request pueda influir indebidamente en el tenant efectivo.

### 13.3 Atomicidad

- Si las mutaciones con auditoria + outbox realmente estan cerrando todos los huecos de consistencia.
- Si hay riesgo de doble escritura o eventos inconsistentes.

### 13.4 Evolucion del dominio

- Si el modelo actual de `Package`, `Prealert` y `PackageReception` soporta bien los tickets 27 al 45 sin obligar refactors grandes.
- Si la granularidad actual de estados es suficiente o puede quedarse corta para inventario, embarques y tracking.

### 13.5 Seguridad

- Si la estrategia actual de cookies, CSRF, sessions, throttling y permisos es suficiente para el MVP.
- Si hay superficies sensibles sin endurecer todavia.

### 13.6 Performance y datos

- Si los indices Prisma / SQL actuales ya cubren bien listados y relaciones principales.
- Si ciertas consultas podrian degradarse rapido cuando suba el volumen operativo.

### 13.7 Frontend backoffice

- Si el contrato frontend/backend esta razonablemente limpio.
- Si la estrategia de app router, auth provider y permission boundaries es sostenible para los tickets siguientes.

## 14. Observaciones tecnicas honestas

- El sistema ya tiene una base bastante solida para seguir con operaciones de courier.
- Aun asi, la parte implementada sigue siendo un MVP tecnico-operativo, no una solucion completa de punta a punta.
- El dominio mas riesgoso hacia adelante sera la transicion desde "recepcion" hacia "inventario, movimiento, tracking y facturacion" sin inflar demasiado `packages`.
- El outbox ya existe, pero todavia falta demostrar el ciclo completo de consumo, notificacion e integraciones externas.
- El frontend ya sirve como backoffice real inicial, pero aun no ha entrado en la complejidad fuerte de warehouse operations.

## 15. Preguntas sugeridas para Gemini Pro

Puedes pasarle este archivo y pedirle una revision con foco en:

1. Si la arquitectura actual esta bien encaminada para un SaaS courier multi-tenant.
2. Que modulos o limites le preocupan mas antes de entrar a tickets 27-45.
3. Si el modelado actual de `Package`, `Prealert` y `PackageReception` es suficiente para soportar inventario, tracking y embarques.
4. Si ve riesgos reales en seguridad, permisos o aislamiento tenant.
5. Si detecta deuda tecnica temprana que convenga corregir antes de seguir expandiendo el dominio.
6. Si recomienda algun ajuste de diseno antes de documentos, inventario y escaneo.

## 16. Archivos clave para revisar junto con este resumen

Si Gemini necesita evidencia directa del codigo, estos archivos le daran buena cobertura:

- `AGENTS.md`
- `README.md`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.module.ts`
- `apps/api/src/auth/`
- `apps/api/src/rbac/`
- `apps/api/src/organizations/`
- `apps/api/src/customers/`
- `apps/api/src/prealerts/`
- `apps/api/src/packages/`
- `apps/api/src/audit/`
- `apps/api/test/`
- `apps/web/src/app/(backoffice)/`
- `apps/web/src/lib/api/`
- `compose.dev.yml`
- `docs/adr/`
- `docs/Tickets_26_al_45/00_INDICE.md`

## 17. Conclusion corta

Hasta Ticket 26, el proyecto ya tiene:

- base multi-tenant real
- autenticacion y autorizacion funcionales
- base de datos versionada
- auditoria y outbox
- backoffice inicial usable
- flujo operativo hasta recepcion del paquete

Lo que falta ya no es bootstrap ni infraestructura basica. Lo siguiente es expansion fuerte del dominio operativo y alli sera donde se va a notar si las decisiones tomadas hasta ahora escalan bien o empiezan a pedir correcciones estructurales.
