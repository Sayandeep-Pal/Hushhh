# Legacy data migration

The security revision changes identity and message schemas. Existing identities lack device-held credentials and therefore **must re-register**; the migration deliberately revokes their old sessions instead of attempting to recreate a secret credential.

## Before running

1. Take and verify a MongoDB backup.
2. Stop application writers or put the service in maintenance mode.
3. Configure `MONGO_URI` for the target environment. Never run this against an environment you did not intend to migrate.
4. Run the dry run and record its report:

```bash
cd server
node scripts/migrate-legacy-data.js
```

## Apply

After reviewing the backup and dry-run report, run:

```bash
MIGRATION_CONFIRM=HUSHHH_REVOKE_LEGACY_IDENTITIES node scripts/migrate-legacy-data.js --apply
```

The migration:

- marks legacy identities as requiring re-registration and invalidates their existing sessions;
- creates explicit direct conversations for valid old two-user room IDs;
- moves valid legacy messages to `conversationId` records; and
- leaves malformed/orphaned records untouched and reports them as skipped.

Validate message counts and conversations before restarting writers. Keep the backup until a staged client rollout has completed.
