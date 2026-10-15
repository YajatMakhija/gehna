import EmbeddedPostgres from 'embedded-postgres';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
const config = JSON.parse(readFileSync(new URL('../.local/database.json', import.meta.url), 'utf8'));
mkdirSync('.local', { recursive: true });
const pg = new EmbeddedPostgres({ databaseDir: '.local/postgres', user: 'gehna', password: config.password, port: 15432, persistent: true, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: console.error });
if (!existsSync('.local/postgres/PG_VERSION')) await pg.initialise();
try { await pg.start(); } catch { throw new Error('PostgreSQL could not start on port 15432. Check whether another local database process is already running.'); }
const client = pg.getPgClient(); await client.connect();
const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = 'gehna_store'");
if (!rows.length) await client.query("CREATE DATABASE gehna_store ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0");
await client.end();
console.log('Gehna PostgreSQL is listening on 127.0.0.1:15432. Keep this terminal running.');
let stopping = false;
async function stop() { if(stopping) return; stopping=true; await pg.stop(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop); setInterval(() => {}, 60000);
