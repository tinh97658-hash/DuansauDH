'use strict';

// Read Git blobs, never working-tree secrets. No dependencies or index mutations.
const { execFileSync } = require('node:child_process');

function violations(name, bytes) {
  const p = name.replace(/\\/g, '/');
  const reasons = [];
  const example = /(^|\/)\.env(?:\.[^/]+)?\.example$|(^|\/)\.env\.example$/i.test(p);
  if (/(^|\/)\.env(?:\.[^/]+)?$/i.test(p) && !example) reasons.push('local environment');
  if (/(^|\/)(?:\.tmp|\.local|node_modules|dist|build|coverage|backups?|test-results|playwright-report|blob-report)(?:\/|$)/i.test(p) || /(^|\/)node_modules-before-[^/]+\//i.test(p)) reasons.push('local/generated directory');
  if (/\.(?:dump|backup|bak|p12|pfx|key|tmp|temp|log)(?:\.[^/]*)?$/i.test(p) || /(?:^|\/)(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$|(?:private|_key)\.pem$/i.test(p)) reasons.push('backup, runtime output or private key');
  if (/\.(?:sql\.(?:gz|zip|bz2|xz)|sqlite3?|db)$/i.test(p)) reasons.push('database archive/file');
  if (/^backend\/public\/(?:userDocs|submissions\/submitted|img\/users)\//i.test(p) || /^artifacts\/.*-subject-code-conflicts\.json$/i.test(p)) reasons.push('runtime upload/database export');
  if (/^artifacts\/ho-so-thac-si-chuan-hoa\//i.test(p)) reasons.push('document awaiting privacy review');
  const text = bytes.toString('utf8');
  if (bytes.subarray(0, 5).toString() === 'PGDMP' || /^-- PostgreSQL database dump/m.test(text)) reasons.push('database dump content');
  if (/-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/.test(text)) reasons.push('private key content');
  if (/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|sk_live_[A-Za-z0-9]{20,})\b/.test(text)) reasons.push('high-confidence token');
  if (/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s/:]+:[^\s@${}<>]+@/i.test(text)) reasons.push('database URL with password');
  return reasons;
}

function scan(args, cwd = process.cwd()) {
  const git = (...a) => execFileSync('git', a, { cwd, maxBuffer: 128 * 1024 * 1024 });
  const list = buffer => buffer.toString('utf8').split('\0').filter(Boolean);
  const findings = [];
  let count = 0;
  function inspect(spec, names, label) {
    for (const name of names) {
      const bytes = git('show', `${spec}:${name}`);
      count++;
      for (const reason of violations(name, bytes)) findings.push({ revision: label, file: name, reason });
    }
  }
  if (args.length === 1 && args[0] === '--staged') {
    if (git('diff', '--name-only', '--diff-filter=U').length) throw new Error('Unresolved index conflicts');
    inspect('', list(git('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMRT', '--no-renames')), 'index');
  } else if (args.length === 2 && args[0] === '--range') {
    const match = /^([^\s.]+(?:[/.][^\s.]*)*)\.\.([^\s]+)$/.exec(args[1]);
    if (!match || args[1].includes('...') || match[1].startsWith('-') || match[2].startsWith('-')) throw new Error('Expected explicit base..tip');
    const base = git('rev-parse', '--verify', `${match[1]}^{commit}`).toString().trim();
    const tip = git('rev-parse', '--verify', `${match[2]}^{commit}`).toString().trim();
    const commits = git('rev-list', `${base}..${tip}`).toString().trim().split(/\s+/).filter(Boolean);
    for (const commit of commits) {
      // Compare against every parent, including merges; catches transient additions.
      const parents = git('rev-list', '--parents', '-n', '1', commit).toString().trim().split(' ').slice(1);
      const names = new Set();
      for (const parent of parents.length ? parents : [null]) {
        const diffArgs = parent ? ['diff', parent, commit] : ['diff-tree', '--root', '--no-commit-id', '-r', commit];
        for (const name of list(git(...diffArgs, '--name-only', '-z', '--diff-filter=ACMRT', '--no-renames'))) names.add(name);
      }
      inspect(commit, [...names], commit.slice(0, 12));
    }
    console.log(`Reviewed ${commits.length} outgoing commit(s).`);
  } else throw new Error('Usage: node scripts/git-safety.cjs --staged | --range origin/vt11..HEAD');
  for (const finding of findings) console.error(`${finding.revision} ${JSON.stringify(finding.file)}: ${finding.reason}`);
  console.log(`Checked ${count} blob(s); ${findings.length} finding(s). No secret values printed.`);
  return findings.length ? 1 : 0;
}

if (require.main === module) {
  try { process.exitCode = scan(process.argv.slice(2)); }
  catch { console.error('Safety check failed: invalid arguments, Git reference, conflict, or unreadable blob.'); process.exitCode = 2; }
}
module.exports = { violations, scan };
