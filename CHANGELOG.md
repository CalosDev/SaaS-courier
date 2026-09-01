# Changelog

## P0 de auditoria tecnica · 2026-08-31

- Se restringe la redireccion posterior al login a rutas internas seguras.
- `/backend/*` usa un proxy server-only configurado en runtime y conserva el
  host tenant mediante una cabecera controlada.
- La maquina de estados de paquetes queda centralizada y respaldada por una
  restriccion PostgreSQL; tracking administrativo deja de cambiar estados y
  sus eventos se protegen como evidencia append-only.
- Se elimina la consulta de tracking externo simulada del API y del backoffice.
- El perfil aduanero actualiza identidad y verificacion en una sola transaccion;
  la procedencia oficial queda reservada a actores de integracion.

## v0.2 · 2026-06-23

- Se documenta Docker para desarrollo híbrido, integración y producción.
- Se define el monorepo pnpm + Turborepo.
- Se agrega `services` como catálogo configurable.
- Se normaliza tracking y se exige carrier, con `UNKNOWN` por tenant.
- `organization.status` queda como autoridad del tenant.
- TAX y DISCOUNT se mantienen en la cabecera de factura.
- Reembolsos quedan fuera del MVP inicial.
- Se protegen las líneas de facturas emitidas.
- Se impiden tarifas solapadas con exclusión GiST.
- Se agrega plan de implementacion, ADRs y plantillas Docker.
