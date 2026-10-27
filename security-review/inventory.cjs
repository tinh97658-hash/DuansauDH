const fs = require('node:fs');
const cp = require('node:child_process');
const ts = require('../backend/node_modules/typescript');
const files = cp.execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const controllers = files.filter(f => f.startsWith('backend/src/') && f.endsWith('.controller.ts'));
const routes = [];
function decorators(node) {
  return (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : []).map(d => d.expression).filter(ts.isCallExpression)
    .map(c => ({ name: c.expression.getText(), args: c.arguments.map(a => a.getText()) }));
}
for (const file of controllers) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements.filter(ts.isClassDeclaration)) {
    const dec = decorators(node);
    const prefix = dec.find(d => d.name === 'Controller')?.args[0]?.replace(/^["']|["']$/g, '') || '';
    for (const method of node.members) {
      const md = decorators(method);
      for (const route of md.filter(d => ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Head', 'Options', 'All'].includes(d.name))) {
        routes.push({ method: route.name.toUpperCase(), path: '/' + [prefix, route.args[0]?.replace(/^["']|["']$/g, '')].filter(Boolean).join('/'),
          file, line: source.getLineAndCharacterOfPosition(method.getStart(source)).line + 1,
          guards: [...dec, ...md].filter(d => d.name === 'UseGuards').flatMap(d => d.args),
          permissions: (md.find(d => d.name === 'RequirePermissions') || dec.find(d => d.name === 'RequirePermissions'))?.args || [],
        });
      }
    }
  }
}
fs.writeFileSync('security-review/api-inventory.json', JSON.stringify(routes, null, 2) + '\n');
const summary = { trackedFiles: files.length, controllers: controllers.length, routes: routes.length,
  scope: ['backend/src/', 'backend/test/', 'frontend/src/', 'frontend/src/test/'].map(prefix => ({ prefix, files: files.filter(f => f.startsWith(prefix)).length })),
  dependencies: {}, licenseInventory: {}, sourceFiles: files.filter(f => /\.(ts|tsx|js|jsx|cjs|py|ya?ml|json)$/.test(f) && !f.startsWith('pgsms-full-backup-')) };
for (const project of ['root', 'backend', 'frontend']) {
  const prefix = project === 'root' ? '' : project + '/';
  const lock = JSON.parse(fs.readFileSync(prefix + 'package-lock.json', 'utf8'));
  const licenses = {};
  for (const [name, pkg] of Object.entries(lock.packages || {})) if (name) licenses[pkg.license || 'NOT_DECLARED_IN_LOCK'] = (licenses[pkg.license || 'NOT_DECLARED_IN_LOCK'] || 0) + 1;
  summary.licenseInventory[project] = licenses;
  const audit = JSON.parse(fs.readFileSync('security-review/audit-' + project + '.json', 'utf8').replace(/^\uFEFF/, ''));
  summary.dependencies[project] = { ...audit.metadata, findings: Object.values(audit.vulnerabilities || {}).map(v => ({
    name: v.name, severity: v.severity, direct: v.isDirect, fixAvailable: v.fixAvailable,
    instances: v.nodes.map(n => ({ path: n, version: lock.packages[n]?.version, dev: !!lock.packages[n]?.dev })),
    advisories: v.via.filter(a => typeof a === 'object'),
  })) };
}
fs.writeFileSync('security-review/inventory.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ trackedFiles: files.length, controllers: controllers.length, routes: routes.length,
  licensesRequiringReview: Object.fromEntries(Object.entries(summary.licenseInventory).map(([k,v]) => [k, Object.fromEntries(Object.entries(v).filter(([license]) => /GPL|MPL|EPL|NOT_DECLARED|UNLICENSED/i.test(license)))])) }, null, 2));
