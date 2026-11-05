const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

const runner = path.join(__dirname, 'dev.cjs');

function run(env) {
  const child = spawn(process.execPath, [runner], { env, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

test('direct invocation explains the required npm command', async () => {
  const env = { ...process.env };
  delete env.npm_execpath;
  const result = await run(env);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /npm run dev/);
});

test('starts both services and stops the sibling process tree on failure', { timeout: 15000 }, async () => {
  const result = await run({
    ...process.env,
    npm_execpath: path.join(__dirname, 'fixtures', 'dev-service.cjs'),
  });
  assert.equal(result.code, 7);
  assert.match(result.stdout, /fixture-backend:/);
  assert.match(result.stdout, /fixture-frontend:/);
  assert.match(result.stdout, /fixture-worker:/);
  for (const match of result.stdout.matchAll(/fixture-(?:backend|frontend|worker):(\d+)/g)) {
    assert.throws(() => process.kill(Number(match[1]), 0), { code: 'ESRCH' });
  }
});
