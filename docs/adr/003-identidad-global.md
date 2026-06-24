# ADR 003 · Identidad global con perfiles por tenant

**Decisión:** `users.email` es global; employees y customers pertenecen a organizations.

**Razón:** una persona puede relacionarse con más de un courier sin duplicar credenciales.

**Consecuencia:** ningún courier puede descubrir asociaciones del usuario con otros tenants.
