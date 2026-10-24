#!/bin/sh
# Recreate the local test database: Supabase stand-ins + schema + seed.
set -e
P="psql -h ${PGHOST:-/tmp} -p ${PGPORT:-5433} -U postgres -q"
cd "$(dirname "$0")/.."
$P -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'fu' and pid <> pg_backend_pid()" >/dev/null
$P -c "drop database if exists fu" -c "create database fu"
$P -d fu -f dev/supabase_stub.sql 2>/dev/null || true
$P -d fu -c "create schema if not exists storage; create table if not exists storage.buckets(id text primary key, name text, public boolean);"
$P -v ON_ERROR_STOP=1 -d fu -f supabase/migrations/20261025000000_schema.sql
$P -v ON_ERROR_STOP=1 -d fu -f dev/grants.sql
$P -v ON_ERROR_STOP=1 -d fu -f supabase/seed.sql
echo "database fu ready"
