#!/usr/bin/env bash
# Local DB security test. Needs a Postgres 16 server you can reach as a superuser.
set -euo pipefail
DB=carstory_test
cd "$(dirname "$0")"
# Supabase's SQL editor has extensions on the path; so do we.
export PGOPTIONS='-c search_path=public,extensions'
psql -q -c "drop database if exists $DB" -c "create database $DB" postgres
psql -q -v ON_ERROR_STOP=1 -d $DB -f supabase_stub.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f ../../supabase/migrations/0001_init.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f ../../supabase/migrations/0002_dashboard.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f ../../supabase/migrations/0003_walkins_addons.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f ../../supabase/migrations/0004_customer_page.sql
psql -q -v ON_ERROR_STOP=1 -d $DB -f security.test.sql
