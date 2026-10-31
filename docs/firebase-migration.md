# Gonglog database

Production runs on Vercel; the database is Cloud Firestore in Firebase project
`gonglog-5eac1`, region `asia-northeast3` (Seoul). The Firebase project display name
is `gonglog`. `vocab_data`, `azure_tts_audio` and `azure_tts_usage` belong to the
separate voca app and must not be modified or deleted.

## Application access

- Vercel production requires server-only `FIREBASE_SERVICE_ACCOUNT_JSON` and
  `LAW_API_KEY`. Never prefix the credential with `NEXT_PUBLIC_` or commit it.
- `gonglog-data` has `roles/datastore.user` in this project only. Firestore rules
  deny all direct client access. Database deletion protection is enabled.
- This app retains its existing shared access model (no individual login).
  API users share one study dataset. An Origin check rejects cross-origin browser
  writes; this is not user authentication. Add owner authentication before
  introducing private multi-user accounts.
- `study_state/current` stores lossless gzipped JSON, its SHA-256, a monotonically
  increasing revision, and source row ID/creation time. Gzip avoids Firestore's
  document size and nesting limitations. Oversized saves fail without replacing
  existing data. Concurrent stale saves return HTTP 409.
- `law_articles/{sha256(article_key)}` stores each original row as JSON, plus
  searchable `law_name`, `article_no`, `article_key`. Upserts preserve original
  fields (including source IDs and creation times).
- Desktop/mobile wait for a successful load before saving. Saves run in order
  after a 700 ms pause. Load/save failures block editing; failed changes have a
  browser-local recovery copy and can be downloaded from the error screen.
  A browser shutdown while writes are pending requires user attention.

## Migration and verification

Keep backups outside the repository, readable only by the current OS user.
The original export directory is `~/.codex/backups/gonglog/20261031T174315Z`.
The script reads only `ox_data` and `law_articles`, exports every source row, and
compares all source fields (not just counts) with Firestore. IDs, timestamps,
HTML, question metadata, and all nested values must match. It never deletes or
updates Supabase data. It refuses to replace existing study state that differs.

```sh
node --env-file=.env.local scripts/migrate-to-firebase.mjs --import /absolute/private/new-backup-directory
node --env-file=.env.local scripts/migrate-to-firebase.mjs --verify /absolute/private/another-new-directory
```

Each backup directory must be new. `verification.json` records row counts,
checksums, project ID, and verification time. Re-run verification immediately
before cutover and check source changes. Import is an initial transfer only;
never run it over a live destination to synchronize ongoing user edits.

Deploy DB rules/indexes with the authorized Firebase CLI:

```sh
npx firebase-tools deploy --only firestore --project gonglog-5eac1
```

## Cutover and retirement

1. Export, import, and verify both tables. Preserve the backup.
2. Build/typecheck, test study read/write/conflict behavior and law lookup.
   Before user edits resume, run `node scripts/verify-firebase-api.mjs BASE_URL BACKUP_DIRECTORY`.
   It checks all state fields against the verified backup, performs two concurrent
   identical-data saves (one must conflict), rejects invalid/cross-origin writes,
   verifies a cached law article exactly, and confirms direct DB reads are denied.
   It only increments the state revision; application contents remain identical.
3. Commit/push current main and verify the connected Vercel production deployment.
4. Reopen all running gonglog windows so they use the new version. Old windows
   can still write Supabase. Compare the final source snapshot before retiring it;
   reconcile any changes rather than overwriting Firestore.
5. Remove unused Supabase environment variables from the lexdeck Vercel project.
6. Only retire gonglog tables after verified cutover and the required permanent
   deletion confirmation. **Do not delete the shared Supabase project**: voca
   continues to use it. Keep original backup files after retirement.

Before any rollback after Firestore has accepted edits, export Firestore and
reconcile those changes; a blind rollback to Supabase would discard new edits.
