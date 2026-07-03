import { config } from 'dotenv';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

config({ path: path.resolve(__dirname, '../..', '.env'), quiet: true });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required. Copy .env.example to .env or set DATABASE_URL in the environment.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
