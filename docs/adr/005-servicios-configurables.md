# ADR 005 · Servicios configurables

**Decisión:** usar tabla `services` en lugar de enum.

**Razón:** cada courier ofrece nombres y modalidades diferentes.

**Consecuencia:** packages y rate_rules referencian `service_id`.
