const { spawn } = require('node:child_process');

if (process.argv.includes('--worker')) {
  console.log(`fixture-worker:${process.pid}`);
  setInterval(() => {}, 1000);
} else {
  const service = process.argv[process.argv.indexOf('--prefix') + 1];
  console.log(`fixture-${service}:${process.pid}`);
  if (service === 'backend') {
    setTimeout(() => process.exit(7), 1000);
  } else {
    spawn(process.execPath, [__filename, '--worker'], { stdio: 'inherit', windowsHide: true });
    setInterval(() => {}, 1000);
  }
}
