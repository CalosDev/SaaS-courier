# Backup y restauracion

## Respaldo local verificable

```powershell
pnpm pilot:backup
pnpm pilot:restore:verify
```

El backup usa formato custom de `pg_dump`. La verificacion crea una base aislada,
restaura el archivo, comprueba migraciones completadas y elimina la base temporal.
Los archivos quedan en `.artifacts/backups` y no se versionan.

## Produccion

- Usar snapshots cifrados del proveedor y PITR cuando este disponible.
- Definir RPO/RTO con el responsable del negocio antes del piloto.
- Verificar restauracion en un entorno aislado con periodicidad programada.
- Restringir acceso, registrar cada restauracion y aplicar retencion aprobada.
- Nunca restaurar sobre produccion como primera prueba de un backup.
