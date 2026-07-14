# Revision de seguridad Modelo A+

Fecha: 2026-07-12
Alcance: NestJS, Next.js, autenticacion, permisos, multi-tenancy, logs e integraciones del monorepo Courier SaaS.

## Resumen ejecutivo

La base de seguridad es consistente: autenticacion por sesiones opacas hash-only, cookies HttpOnly y SameSite Strict, CSRF con validacion de origen, DTOs con whitelist estricta, permisos evaluados desde base de datos y relaciones Prisma tenant-safe. No se encontraron dependencias productivas con vulnerabilidades conocidas mediante `pnpm audit --prod --audit-level high`.

La revision encontro y corrigio un hallazgo critico: la simulacion SIGA podia presentarse al usuario como una transmision oficial y cambiar el estado persistido del manifiesto. Tambien se corrigieron dos hallazgos sobre exposicion de payloads en logs y confianza directa en `X-Forwarded-For`.

## Critico

### SEC-001 - La simulacion SIGA genera evidencia operativa falsa

- Severidad: Critica.
- Estado: Corregido con autorizacion explicita.
- Ubicaciones:
  - `apps/api/src/customs-manifests/customs-manifests.service.ts`
  - `apps/api/src/customs-manifests/customs-manifests.controller.ts`
  - `apps/web/src/app/(backoffice)/customs-manifests/[id]/page.tsx`
  - `apps/web/src/app/(backoffice)/customs-manifests/page.tsx`
- Evidencia: el servicio simulado devuelve exito y una referencia `SIGA-*`; posteriormente el manifiesto cambia a `SUBMITTED` y la interfaz informa que fue transmitido a SIGA.
- Impacto: un operador puede interpretar una simulacion como declaracion oficial, continuar el proceso aduanero con un estado falso y conservar auditoria/outbox que aparentan una transmision real.
- Correccion: se eliminaron el endpoint, la transicion simulada, el cliente frontend, las acciones visibles y el modulo simulado. La preparacion manual de manifiestos permanece disponible sin cambiar su estado a `SUBMITTED`.
- Condicion futura: una integracion SIGA solo podra reintroducirse con autorizacion oficial, contrato tecnico, credenciales seguras, pruebas contra sandbox autorizado y aceptacion operativa.

## Alto

### SEC-002 - Payloads operativos completos en logs

- Severidad: Alta.
- Estado: Corregido.
- Ubicaciones:
  - `apps/api/src/notifications/webhook-dispatcher.service.ts:48`
  - Modulo SIGA simulado eliminado durante SEC-001.
- Evidencia previa: el modo webhook simulado serializaba `payload.payload` y el antiguo simulador SIGA serializaba el manifiesto completo.
- Impacto: documentos, identificadores u otra informacion operacional podian terminar en logs.
- Correccion: los logs conservan tipo de evento, IDs y organizacion, pero nunca el payload.
- Pruebas: `webhook-dispatcher.service.spec.ts` y `siga-api.service.spec.ts` verifican que datos sensibles no sean registrados.

## Medio

### SEC-003 - Rate limiting confiaba directamente en X-Forwarded-For

- Severidad: Media-alta.
- Estado: Corregido.
- Ubicaciones:
  - `apps/api/src/auth/auth.module.ts:40`
  - `apps/api/src/http/configure-http-app.ts:9`
- Evidencia previa: el tracker tomaba el primer valor de `X-Forwarded-For` sin validar el proxy inmediato.
- Impacto: si el API era accesible directamente, un atacante podia rotar el header para evadir el limite de login.
- Correccion: Express resuelve `request.ip` confiando solo en rangos internos/loopback acordes al proxy same-origin; el throttler ya no interpreta headers manualmente.
- Prueba: `auth.http.e2e-spec.ts` valida login, CSRF y respuesta 429.

### SEC-004 - Cobertura tenant-cross incompleta en dominios avanzados

- Severidad: Media como riesgo de regresion, no vulnerabilidad confirmada.
- Estado: Parcial; transferencias, entregas, embarques maestros, HAWB y manifiestos versionados ya cuentan con E2E PostgreSQL tenant-safe. Los demas dominios avanzados permanecen asignados a la fase de flujos E2E.
- Evidencia: clientes, paquetes, inventario, documentos, facilities, transferencias, entregas, embarques maestros, HAWB, manifiestos, billing, pickups, tracking publico y casos aduaneros tienen pruebas tenant-cross o de concurrencia dedicadas. Rates tiene E2E parcial; holds y correcciones dependen principalmente de pruebas unitarias y filtrado estatico.
- Impacto: una regresion futura en el paso de `organizationId` podria no detectarse en la frontera HTTP.
- Solucion: agregar escenarios HTTP con recurso de otra organizacion y respuesta indistinguible de no encontrado para cada dominio critico.

## Bajo

### SEC-005 - Headers de seguridad del frontend no demostrados

- Severidad: Baja, defensa en profundidad.
- Estado: Abierto; validar durante hardening de infraestructura.
- Evidencia: Helmet protege respuestas NestJS, pero `apps/web/next.config.ts` no define headers propios y no hay evidencia del proxy/CDN productivo.
- Impacto: el despliegue podria carecer de politica anti-framing, referrer policy u otros headers si el ingress tampoco los agrega.
- Solucion: verificar headers en runtime productivo y definirlos en Next.js o ingress sin introducir una CSP incompatible con scripts de Next.

## Controles verificados

- DTOs operativos no aceptan `organizationId`, `employeeId` ni `userId`; `SelectOrganizationDto` es la unica excepcion intencional durante autenticacion.
- `PermissionsGuard` falla cerrado cuando una ruta autenticada no declara permisos ni `AuthenticatedOnly`.
- Cookies productivas requieren `COOKIE_SECURE=true`, usan prefijo `__Host-`, Path `/`, HttpOnly y SameSite Strict.
- CSRF se exige en metodos mutables y valida origen, cookie y header con comparacion constante.
- Prisma usa claves compuestas por organizacion en las relaciones operativas revisadas.
- No se detectaron sinks directos de XSS, ejecucion dinamica, comandos de sistema o SQL raw inseguro en codigo productivo.
- Los SQL raw productivos revisados usan `Prisma.sql`/tagged templates; los usos `Unsafe` estan limitados a limpieza de pruebas.
- Git solo rastrea archivos `.env.example` y no contiene marcadores de claves privadas conocidos.

## Puerta de salida

SEC-001, SEC-002 y SEC-003 estan corregidos. SEC-004 se implementara junto con los E2E de flujos operativos y SEC-005 se verificara en hardening de infraestructura.
