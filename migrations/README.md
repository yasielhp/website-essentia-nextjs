# Migrations

## The registry and this folder disagree

`db migrations list` stops at `20260518190000_blog`. Everything after it in this
folder — 21 files, May through August 2026 — was applied by hand and is live in
the database, but the CLI has no record of it.

Verified on 2026-08-06 against production: all 17 columns those files declare
exist, emails are lowercased, the permissive `anyone_update_contacts` policy is
gone, and `upsert_contact` is present. The schema is correct. Only the registry
is behind.

## Do not try to replay them

`db migrations up` refuses anyway. The first pending file,
`20260518201000_admin-set-password-fn.sql`, ends in:

```sql
GRANT EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) TO service_role;
```

`service_role` is a Supabase role and does not exist on this backend, so the
migration fails with `role "service_role" does not exist`. The CLI stops at the
first failure and applies nothing, which is why `up --all` is not the loaded gun
it looks like: it cannot get past file one. That failure is also the likely
reason these were applied by hand in the first place.

## Which is how one arrived half-applied

`20260521130000_add-preferred-language.sql` adds the column to `contacts` **and**
`profiles`. Only the `contacts` half ever reached the database. Nobody noticed
for three months, until staff turned out to have no language of their own. The
profiles half was applied on 2026-08-06.

If you apply a migration by hand, apply all of it, and check afterwards.

## Writing a new one

`db migrations new <name>` still numbers correctly, and `db query` applies a
single statement when a migration cannot run. Both were used on 2026-08-06 for
`20260806173159_drop-stale-upsert-contact-overload.sql`.

Reconciling the registry properly means writing rows into
`system.custom_migrations`, a backend-managed table with no CLI command behind
it. That is InsForge's to answer, not something to improvise.
