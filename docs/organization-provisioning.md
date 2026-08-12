# Aprovisionamiento interno de organizaciones

Este proceso crea el tenant inicial de un courier existente. Es una operacion
interna de plataforma, no un endpoint publico ni una validacion oficial ante la
DGA, SIGA o DGII.

## Alcance atomico

Una sola transaccion crea:

- organizacion en estado `TRIAL`, settings y perfil regulatorio declarado;
- facility principal;
- usuario administrador en estado `INVITED` y empleado `PENDING`;
- rol de sistema `ORGANIZATION_ADMIN` con el catalogo vigente de permisos;
- asignacion del rol y de la facility principal;
- audit log y evento outbox `organization.provisioned`.

Un conflicto revierte toda la operacion. El correo del administrador debe
pertenecer a un usuario nuevo para evitar asociar identidades existentes sin
consentimiento.

## Procedimiento

1. Crear backup y aplicar migraciones versionadas.
2. Sincronizar el catalogo con `pnpm rbac:sync-permissions`.
3. Copiar `docs/examples/organization-provisioning.example.json` a un archivo
   local con sufijo `.provisioning.local.json` y completar los datos declarados.
4. Ejecutar desde la raiz:

```powershell
$env:ALLOW_ORGANIZATION_PROVISIONING='true'
pnpm provision:organization -- --input .\courier.provisioning.local.json --confirm courier-slug
Remove-Item Env:ALLOW_ORGANIZATION_PROVISIONING
```

`--confirm` debe coincidir exactamente con `organization.slug`. El token de
activacion se muestra una sola vez, expira en 24 horas y debe entregarse por un
canal seguro aprobado. No conservar el JSON real ni la salida del comando en
Git, tickets o logs compartidos.

## Limites regulatorios

Los estados del perfil son declaraciones del courier. No significan que la
plataforma haya verificado autorizaciones oficiales. No introducir en el JSON
certificados, llaves privadas, usuarios o contrasenas de SIGA/DGA/DGII.

La facturacion electronica solo registra el estado de incorporacion. La
integracion con un proveedor fiscal se implementara cuando exista una decision
de proveedor y contrato tecnico aprobado.

## Verificacion y recuperacion

Confirmar que la organizacion, facility, empleado, rol y perfil aparecen en el
backoffice, y que el administrador puede completar su activacion. Consultar el
evento `organization.provisioned` para trazabilidad.

Ante error, no eliminar filas manualmente ni reutilizar el token. Corregir el
archivo local y repetir el comando; la transaccion fallida no deja un tenant
parcial. Si el primer aprovisionamiento finalizo pero contiene datos incorrectos,
corregirlos mediante los flujos administrativos auditados.
