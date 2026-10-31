// Run with node --env-file=.env.local scripts/migrate-to-firebase.mjs --import|--verify BACKUP_DIRECTORY
// The source is always read-only. Backups contain private application data; keep them outside Git.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'node:util';
const mode = process.argv[2];
if (!['--import', '--verify'].includes(mode) || !process.argv[3]) throw Error('Usage: --import|--verify BACKUP_DIRECTORY');
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (credentials.project_id !== 'gonglog-5eac1') throw Error('Unexpected destination project');
const db = getFirestore(initializeApp({ credential: cert(credentials) }));
const directory = resolve(process.argv[3]);
await mkdir(directory, { recursive: true, mode: 0o700 });
const digest = value => createHash('sha256').update(value).digest('hex');
const manifest = { project: credentials.project_id, mode, at: new Date().toISOString(), tables: {} };
for (const table of ['ox_data', 'law_articles']) {
  const rows = [];
  for (let offset = 0;; offset += 500) {
    const url = new URL(`/rest/v1/${table}`, process.env.NEXT_PUBLIC_SUPABASE_URL);
    url.search = new URLSearchParams({ select: '*', order: 'id', limit: '500', offset: String(offset) }).toString();
    const response = await fetch(url, { headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
    if (!response.ok) throw Error(`Source read failed: ${table} ${response.status}`);
    const page = await response.json(); rows.push(...page);
    if (page.length < 500) break;
  }
  const json = JSON.stringify(rows);
  await writeFile(resolve(directory, `${table}.json`), json, { mode: 0o600, flag: 'wx' });
  if (table === 'ox_data') {
    if (rows.length !== 1) throw Error(`Expected one state row, found ${rows.length}`);
    const ref = db.doc('study_state/current');
    const existing = await ref.get();
    if (mode === '--import' && !existing.exists) {
      const encoded = JSON.stringify(rows[0].data);
      const compressed = gzipSync(encoded);
      if (compressed.length > 900_000) throw Error('State exceeds document limit');
      await ref.create({ compressed, sha256: digest(encoded), revision: 1, sourceId: rows[0].id, sourceCreatedAt: rows[0].created_at, migratedAt: new Date().toISOString() });
    }
    const state = await ref.get();
    if (!state.exists || !isDeepStrictEqual(JSON.parse(gunzipSync(state.get('compressed')).toString()), rows[0].data) || state.get('sourceId') !== rows[0].id || state.get('sourceCreatedAt') !== rows[0].created_at) throw Error('State differs from source; no overwrite attempted');
  } else {
    if (new Set(rows.map(row => row.article_key)).size !== rows.length) throw Error('Duplicate article keys');
    if (mode === '--import') {
      const existing = await db.collection(table).get();
      const byKey = new Map(rows.map(row => [digest(row.article_key), row]));
      for (const doc of existing.docs) {
        if (!isDeepStrictEqual(JSON.parse(doc.get('json')), byKey.get(doc.id))) throw Error('Existing destination article differs; no overwrite attempted');
      }
      const writer = db.bulkWriter();
      const writes = rows.map(row => writer.set(db.collection(table).doc(digest(row.article_key)), { json: JSON.stringify(row), law_name: row.law_name, article_no: row.article_no, article_key: row.article_key }));
      await writer.close(); await Promise.all(writes);
    }
    const target = await db.collection(table).get();
    if (target.size !== rows.length) throw Error('Article count mismatch');
    const destination = new Map(target.docs.map(doc => [doc.id, JSON.parse(doc.get('json'))]));
    for (const row of rows) if (!isDeepStrictEqual(destination.get(digest(row.article_key)), row)) throw Error(`Article differs: ${row.id}`);
  }
  manifest.tables[table] = { rows: rows.length, bytes: Buffer.byteLength(json), sha256: digest(json), verified: true };
  console.log(`${table}: ${rows.length} rows, all fields verified`);
}
await writeFile(resolve(directory, 'verification.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
console.log('Migration verification passed. Source data was not modified.');
await db.terminate();
