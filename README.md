# SaaS Courier

Plataforma web multi-tenant para la operacion diaria de empresas de courier en
Republica Dominicana. Cada courier opera como una `organization` aislada, con
sus propias facilities, usuarios, clientes y datos operativos.

## Que incluye

- Backoffice para organizaciones y facilities.
- Usuarios, roles y permisos por organizacion.
- Clientes, direcciones, perfiles aduaneros e importacion inicial.
- Prealertas, paquetes, recepcion fisica e inventario.
- Guias, embarques, consolidaciones y transferencias internas.
- Tracking publico limitado y eventos operativos.
- Casos y manifiestos aduaneros.
- Tarifas, facturacion y registro de pagos.
- Documentos de paquetes con almacenamiento compatible con S3.
- Notificaciones, integraciones con carriers y reportes operativos.

El proyecto se mantiene como un monolito modular durante el MVP. PostgreSQL es
la fuente de verdad y NestJS concentra las reglas de negocio.

## Arquitectura

```text
apps/web       Next.js, React y TypeScript
apps/api       NestJS, Prisma y TypeScript estricto
PostgreSQL     Datos operativos y migraciones versionadas
MinIO          Almacenamiento local compatible con S3
Mailpit        Correo local para desarrollo
Docker         Servicios de desarrollo e imagenes de produccion
```

El frontend consume la API. No accede directamente a PostgreSQL. La API valida
la organizacion de cada solicitud, aplica permisos y mantiene las transacciones
del dominio.

## Requisitos

- Node.js LTS
- pnpm `10.30.2`
- Docker Desktop
- Git

## Ejecutar localmente

Desde la raiz del repositorio:

```powershell
Copy-Item .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate:deploy
pnpm dev
```

La aplicacion web queda disponible en `http://localhost:3000` y la API en
`http://localhost:4000`.

Para revisar los servicios locales:

```powershell
pnpm db:status
pnpm db:logs
pnpm db:down
```

El comando `db:up` inicia PostgreSQL, MinIO y Mailpit. Los valores de `.env`
son solo para desarrollo local; no deben subirse a Git.

## Usuario local

El bootstrap local crea una organizacion, una facility, permisos y un usuario
administrador para probar el backoffice. Requiere credenciales definidas solo
en la sesion local:

```powershell
$env:ALLOW_LOCAL_BOOTSTRAP='true'
$env:LOCAL_BOOTSTRAP_EMAIL='admin@example.test'
$env:LOCAL_BOOTSTRAP_PASSWORD='change-this-local-password'
pnpm bootstrap:local
Remove-Item Env:ALLOW_LOCAL_BOOTSTRAP, Env:LOCAL_BOOTSTRAP_EMAIL, Env:LOCAL_BOOTSTRAP_PASSWORD
```

La contrasena debe tener al menos 12 caracteres. No uses credenciales reales en
este flujo.

## Comandos principales

```powershell
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

Las pruebas E2E requieren Docker activo, PostgreSQL disponible y Chromium
instalado para Playwright:

```powershell
pnpm --filter @courier/web exec playwright install chromium
```

## Base de datos

Prisma y sus migraciones viven en `apps/api/prisma`. Para revisar el esquema y
el estado de la base:

```powershell
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm db:check
pnpm db:migrate:status
```

Los cambios de base de datos deben realizarse mediante migraciones versionadas.
No usar `prisma db push` en produccion.

## Seguridad y aislamiento

- Cada consulta operativa se limita a la organizacion autenticada.
- La organizacion no se acepta desde el body, query string o headers del navegador.
- Las sesiones usan cookies HttpOnly, Secure y SameSite.
- El frontend no almacena tokens en `localStorage`.
- Los datos de dinero se guardan en unidades menores con `bigint`.
- Los eventos de paquetes y logs de auditoria son append-only.
- No se registran contrasenas, tokens ni credenciales de integraciones.

## Documentacion

- [Desarrollo local](docs/development.md)
- [Docker](docs/docker.md)
- [Despliegue](docs/deployment.md)
- [Base de datos](docs/database.md)
- [Aprovisionamiento de organizaciones](docs/organization-provisioning.md)
- [Runbook del piloto](docs/pilot-runbook.md)
- [Checklist UAT](docs/pilot-uat-checklist.md)
- [Decisiones de arquitectura](docs/adr/)
- [Documentacion historica](docs/archive/)

## Alcance actual

El repositorio contiene la linea base funcional del Modelo A+ y los modulos
operativos definidos para el piloto. Las integraciones regulatorias y con
carriers se mantienen sujetas a sus contratos, credenciales y validaciones
externas correspondientes.
