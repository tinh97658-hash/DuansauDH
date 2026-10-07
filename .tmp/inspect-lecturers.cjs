const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../backend/package.json'));
const frontReq = createRequire(path.resolve(__dirname, '../frontend/node_modules/react-scripts/package.json'));
const dotenv = frontReq('dotenv');
frontReq('dotenv-expand')(dotenv.config({ path: path.resolve(__dirname, '../.env') }));
const { Client } = req('pg');
(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER}:${encodeURIComponent(process.env.POSTGRES_PASSWORD)}@localhost:${process.env.DB_PORT}/${process.env.POSTGRES_DB}` });
  await client.connect();
  for (const sql of [
    "SELECT current_database() AS database, inet_server_addr() AS server",
    "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='lecturers' ORDER BY ordinal_position",
    "SELECT count(*) AS count FROM lecturers",
    "SELECT code,name,faculty,academic_rank,academic_degree,teaching_type FROM lecturers ORDER BY code LIMIT 5",
    "SELECT conrelid::regclass::text AS source_table, conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE confrelid='lecturers'::regclass",
    "SELECT count(*) AS teaching_sessions FROM teaching_sessions WHERE lecturer_id IN (SELECT id FROM lecturers)",
    "SELECT table_name,column_name FROM information_schema.columns WHERE column_name ILIKE '%lecturer%' ORDER BY table_name,column_name",
  ]) console.log(JSON.stringify((await client.query(sql)).rows, null, 2));
  await client.end();
})().catch(error => { console.error(error.message); process.exitCode = 1; });
