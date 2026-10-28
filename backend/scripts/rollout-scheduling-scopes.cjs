// Preflight/report by default. --apply backs up the configured database and applies
// only migrations 082/083/084; it never replays the historical pending migration list.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Sequelize, QueryTypes } = require('sequelize');

const root = path.resolve(__dirname, '../..');
const config = {};
for (const file of ['.env', 'backend/config.env']) {
  const filename = path.join(root, file);
  if (!fs.existsSync(filename)) continue;
  for (const line of fs.readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
    if (match) config[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
Object.assign(config, Object.fromEntries(Object.entries(process.env).filter(([key]) => ['DATABASE_URL', 'PG_DUMP'].includes(key))));
const uri = config.DATABASE_URL ? new URL(config.DATABASE_URL)
  : new URL(`postgres://${encodeURIComponent(config.POSTGRES_USER)}:${encodeURIComponent(config.POSTGRES_PASSWORD)}@localhost:${config.DB_PORT}/${config.POSTGRES_DB}`);
const output = path.join(root, '.tmp', 'scheduling-scopes-rollout');
fs.mkdirSync(output, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

async function main() {
  const db = new Sequelize(uri.toString(), { logging: false });
  const query = sql => db.query(sql, { type: QueryTypes.SELECT });
  try {
    const [baseline] = await query(`SELECT current_database() AS database,
      to_regclass('role_permission_scopes') AS scopes,
      to_regprocedure('app_institution_permission(text,boolean)') AS automatic_scope,
      to_regprocedure('app_schedule_roster_record_read(uuid)') AS organization_scope,
      to_regprocedure('app_scheduling_offering_allowed(uuid)') AS baseline_081,
      to_regclass('"SequelizeMeta"') AS ledger`);
    if (!baseline.baseline_081) throw new Error('Migration 081 must be verified before applying 082.');
    const roles = await query(`SELECT r.id,r.code,r.name,r.active,r.restrict_group_view,r.restrict_group_edit,r.group_read_only,
      (SELECT count(*)::integer FROM staff s WHERE s.status='active' AND (
        EXISTS(SELECT 1 FROM staff_roles sr WHERE sr.staff_id=s.id AND sr.role_id=r.id)
        OR (NOT EXISTS(SELECT 1 FROM staff_roles sr WHERE sr.staff_id=s.id) AND s.role=r.code))) AS staff_count,
      ARRAY(SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
        WHERE rp.role_id=r.id AND p.code IN ('scheduling.view','scheduling.write','scheduling.organize') ORDER BY p.code) AS permissions
      FROM roles r ORDER BY r.code`);
    const report = {
      generatedAt: new Date().toISOString(), baseline,
      ledger: baseline.ledger ? await query('SELECT name FROM "SequelizeMeta" ORDER BY name') : [],
      roles: roles.map(role => ({ ...role, scopeDecision: 'Granted academic actions automatically use institution scope; action grants and read-only locks remain independent.' })),
      applied: false,
    };
    fs.writeFileSync(path.join(output, `preflight-${stamp}.json`), JSON.stringify(report, null, 2));
    const pending = [];
    if (!baseline.scopes) pending.push('082-scheduling-permission-scopes');
    if (!baseline.organization_scope) pending.push('083-scheduling-organization-scope');
    if (!baseline.automatic_scope) pending.push('084-automatic-institution-academic-scope');
    if (process.argv.includes('--apply') && pending.length) {
      const executable = config.PG_DUMP || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe' : 'pg_dump');
      const backup = path.join(output, `before-${pending[0].slice(0, 3)}-${stamp}.dump`);
      const result = spawnSync(executable, ['--format=custom', '--no-password', '--file', path.basename(backup)], {
        cwd: output,
        env: { ...process.env, PGHOST: uri.hostname, PGPORT: uri.port || '5432', PGUSER: decodeURIComponent(uri.username),
          PGPASSWORD: decodeURIComponent(uri.password), PGDATABASE: decodeURIComponent(uri.pathname.slice(1)) }, encoding: 'utf8',
      });
      if (result.status !== 0) {
        const detail = String(result.error?.code || result.stderr || 'unknown pg_dump error')
          .replaceAll(decodeURIComponent(uri.password), '[redacted]').slice(0, 600);
        throw new Error(`Database backup failed; migration was not started: ${detail}`);
      }
      for (const migration of pending) {
        await require(`../dist/database/migrations/${migration}.js`).up({ context: db.getQueryInterface() });
        if (baseline.ledger) await db.query('INSERT INTO "SequelizeMeta"(name) VALUES (:name) ON CONFLICT(name) DO NOTHING', { replacements: { name: `${migration}.js` } });
      }
      report.applied = true;
      report.appliedMigrations = pending;
      report.backup = backup;
    }
    report.current = (await query(`SELECT to_regclass('role_permission_scopes') AS scopes,
      to_regprocedure('app_schedule_allowed(uuid,text)') AS policy,
      to_regprocedure('app_schedule_roster_record_read(uuid)') AS organization_policy,
      to_regprocedure('app_institution_permission(text,boolean)') AS automatic_policy`))[0];
    if (report.current.scopes) report.configuration = await query(`SELECT r.code,r.scheduling_scope_version,
      COALESCE(jsonb_object_agg(p.code,ps.scope) FILTER(WHERE p.code IS NOT NULL),'{}'::jsonb) AS scopes
      FROM roles r LEFT JOIN role_permission_scopes ps ON ps.role_id=r.id
      LEFT JOIN permissions p ON p.id=ps.permission_id GROUP BY r.id ORDER BY r.code`);
    fs.writeFileSync(path.join(output, `result-${stamp}.json`), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ database: baseline.database, applied: report.applied, roleCount: roles.length,
      current: report.current, reportDirectory: output, backup: report.backup ?? null }, null, 2));
  } finally { await db.close(); }
}
main().catch(error => { console.error(error.original?.message || error.message); process.exitCode = 1; });
