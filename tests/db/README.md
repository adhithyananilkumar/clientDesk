# Database tests

`rls_test.sql` exercises the permission model end to end: tenant isolation,
member ticket visibility, internal notes, role escalation, owner protection,
single-use invitations, assignment rules, the audit trail and storage paths.

Run it against any local PostgreSQL 15+ (no Supabase needed; `supabase_stub.sql`
provides minimal `auth` / `storage` schemas):

```bash
PGPORT=5432 PGUSER=postgres tests/db/run.sh
```

A clean run prints `ALL RLS CHECKS PASSED`; any `FAIL:` line names the broken rule.
Everything runs inside a transaction that is rolled back.
