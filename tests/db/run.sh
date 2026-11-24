#!/usr/bin/env bash
# Applies all migrations to a scratch Postgres database (with stub auth/storage
# schemas) and runs the RLS test suite. Usage: PGPORT=54329 tests/db/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-clientdesk_test}
dropdb --if-exists -U "${PGUSER:-postgres}" "$DB"
createdb -U "${PGUSER:-postgres}" "$DB"
psql -U "${PGUSER:-postgres}" -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/db/supabase_stub.sql 2>&1 | grep -v -i "wal_level\|HINT" || true
for f in supabase/migrations/*.sql; do
  psql -U "${PGUSER:-postgres}" -d "$DB" -q -v ON_ERROR_STOP=1 -1 -f "$f" 2>&1 | grep -v NOTICE || true
done
psql -U "${PGUSER:-postgres}" -d "$DB" -q -v ON_ERROR_STOP=1 -f tests/db/rls_test.sql 2>&1 | grep -E "FAIL|ERROR|PASSED"
