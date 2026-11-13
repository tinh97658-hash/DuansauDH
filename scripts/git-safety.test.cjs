'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { violations } = require('./git-safety.cjs');
const checker = path.join(__dirname, 'git-safety.cjs');

test('rejects sensitive paths and content, keeps legitimate source/templates', () => {
  for (const name of ['.env', '.env.production', 'db.dump', 'db.sql.gz.bak', '.tmp/a', 'backend/dist/a.js', 'backend/public/userDocs/a.pdf', 'artifacts/nt3-subject-code-conflicts.json']) {
    assert.ok(violations(name, Buffer.from('')).length, name);
  }
  for (const name of ['.env.example', '.env.production.example', 'backend/migrations/001.sql', 'frontend/public/logo.png', 'scripts/fixtures/dev-service.cjs']) {
    assert.equal(violations(name, Buffer.from('SELECT 1;')).length, 0, name);
  }
  assert.ok(violations('renamed.bin', Buffer.from('PGDMPpayload')).length);
  assert.ok(violations('source.txt', Buffer.from('-----BEGIN ' + 'PRIVATE KEY-----')).length);
});

test('reads staged blobs and catches transient secrets in outgoing history', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vt11-git-safety-'));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_NAME: 'Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid' } }).trim();
  const run = (...args) => spawnSync(process.execPath, [checker, ...args], { cwd, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    fs.writeFileSync(path.join(cwd, 'safe.txt'), 'source');
    git('add', '--', 'safe.txt');
    const base = git('commit-tree', git('write-tree'), '-m', 'base');
    git('update-ref', 'HEAD', base);
    fs.writeFileSync(path.join(cwd, '.env'), 'fixture');
    git('add', '--', '.env');
    fs.writeFileSync(path.join(cwd, '.env'), 'working tree differs');
    assert.equal(run('--staged').status, 1);
    const unsafe = git('commit-tree', git('write-tree'), '-p', base, '-m', 'unsafe fixture');
    fs.writeFileSync(path.join(cwd, '.env'), 'fixture');
    git('rm', '--cached', '--', '.env');
    const tip = git('commit-tree', git('write-tree'), '-p', unsafe, '-m', 'removed fixture');
    assert.equal(run('--range', `${base}..${tip}`).status, 1);
    assert.equal(run('--range', `${base}..${base}`).status, 0);
    assert.equal(run('--range', 'missing..HEAD').status, 2);
    assert.equal(run('--staged').status, 0);
  } finally {
    // Only this freshly created, OS-temp fixture directory is removable.
    const resolved = path.resolve(cwd);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('vt11-git-safety-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
