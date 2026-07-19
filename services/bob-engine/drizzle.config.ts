import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['bob'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://artemis:artemis@localhost:5432/artemis_united',
  },
})
