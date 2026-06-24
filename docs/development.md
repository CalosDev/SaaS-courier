# Desarrollo local

## Requisitos

- Node.js LTS
- pnpm
- Docker Desktop o motor compatible
- Git

## Modalidad principal

```bash
docker compose -f compose.dev.yml up -d postgres
pnpm install
pnpm dev
```

Next.js y NestJS se ejecutan localmente para mantener hot reload. PostgreSQL se ejecuta en Docker.

## Modalidad completa

```bash
docker compose -f compose.dev.yml --profile full up --build
```

Usar esta modalidad para verificar paridad de contenedores, no necesariamente como flujo diario en Windows.

## Migraciones

```bash
pnpm --filter api prisma migrate dev
pnpm --filter api prisma generate
```

No utilizar `prisma db push` como sustituto del historial de migraciones.
