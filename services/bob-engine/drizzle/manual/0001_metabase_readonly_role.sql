-- Manual infra script — NOT part of the drizzle-kit generated migration chain.
-- drizzle-kit only tracks the `bob` table schema (see drizzle.config.ts schemaFilter),
-- and role/permission statements aren't something it diffs from src/db/schema.ts.
-- Apply by hand (psql / Neon SQL console) against staging and prod. Not needed in
-- local dev unless you want to test the Metabase dashboard against local dev data.
--
-- Before running: replace <SENHA_FORTE_AQUI> with a real generated secret. Never
-- commit the real password to this file or anywhere else in the repo — it belongs
-- in the environment's secrets manager (and locally in .env as METABASE_DB_PASSWORD,
-- see infra/.env.example).
--
-- Read-only, scoped to the `bob` schema only. Never access to `app` (no PII).
CREATE ROLE metabase_readonly WITH LOGIN PASSWORD '<SENHA_FORTE_AQUI>';
GRANT CONNECT ON DATABASE <nome_do_banco> TO metabase_readonly;
GRANT USAGE ON SCHEMA bob TO metabase_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA bob TO metabase_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA bob GRANT SELECT ON TABLES TO metabase_readonly;
REVOKE ALL ON SCHEMA app FROM metabase_readonly;
