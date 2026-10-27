// Run the regression suites that replaced the original vulnerability reproducer.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const base = path.resolve(__dirname, '../backend');
const result = spawnSync(process.execPath, [path.join(base, 'node_modules/jest/bin/jest.js'),
  '--config', 'test/jest.config.cjs', '--runInBand', '--runTestsByPath',
  'test/e2e/security-remediation.e2e-spec.ts', 'test/unit/auth-session.spec.ts',
  'test/unit/upload-storage.spec.ts', 'test/e2e/password-change-required.e2e-spec.ts'],
  { cwd: base, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
