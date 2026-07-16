import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // `generate` works without it; `migrate` fails loudly on the empty string.
    url: process.env.DATABASE_URL ?? '',
  },
});
