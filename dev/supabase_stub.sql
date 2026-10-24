-- Minimal stand-in for what Supabase provides, used only for local testing.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator noinherit login password 'dev'; grant anon, authenticated, service_role to authenticator;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
