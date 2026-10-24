-- Set up a local database in one go (run from the repo folder):
--   psql -U postgres -c "create database fu"
--   psql -U postgres -d fu -f dev/local_setup.sql
\set ON_ERROR_STOP off
\ir supabase_stub.sql
\set ON_ERROR_STOP on
\ir ../supabase/migrations/20261025000000_schema.sql
\ir grants.sql
\ir ../supabase/seed.sql
\echo 'FinUrheilu database ready'
