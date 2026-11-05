const { spawn } = require('node:child_process');
const path = require('node:path');

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error('Start development with: npm run dev');
  process.exit(1);
}

const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
    if (process.platform === 'win32') {
      // npm starts a shell and a watcher: stop the whole owned process tree.
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore', windowsHide: true,
      });
      killer.on('error', () => child.kill());
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); }
      catch (error) { if (error.code !== 'ESRCH') child.kill(); }
    }
  }
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

for (const service of ['backend', 'frontend']) {
  console.log(`[dev] Starting ${service}`);
  const child = spawn(process.execPath, [npmCli, '--prefix', service, 'run', 'dev'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  children.push(child);
  child.on('error', error => {
    console.error(`[dev] ${service}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[dev] ${service} stopped (${signal || code}); stopping development.`);
    stop(code || 1);
  });
}
