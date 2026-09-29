-- JornAI — development database bootstrap (alternative to Docker).
--
-- Run ONCE as a superuser (psql will ask for the 'postgres' password):
--   psql -U postgres -h localhost -f scripts/init-db.sql
--
-- Creates the 'jornai' role (password 'jornai') and the 'jornai' database. Idempotent:
-- it can be run again without error if they already exist.

SELECT 'CREATE ROLE jornai LOGIN PASSWORD ''jornai'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'jornai')\gexec

SELECT 'CREATE DATABASE jornai OWNER jornai'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'jornai')\gexec

-- Makes sure the 'jornai' user can create tables in the public schema.
\connect jornai
GRANT ALL ON SCHEMA public TO jornai;
ALTER SCHEMA public OWNER TO jornai;
