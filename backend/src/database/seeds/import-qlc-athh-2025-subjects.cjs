// Preview: node src/database/seeds/import-qlc-athh-2025-subjects.cjs
// Apply:   node src/database/seeds/import-qlc-athh-2025-subjects.cjs --apply
const { importSubjectCatalog } = require('./import-dtvt-2025-subjects.cjs');
importSubjectCatalog(require('./qlc-athh-2025-subjects.json'), 'qlc-athh-2025-subjects.json')
  .catch(error => { console.error(error.message); process.exitCode = 1; });
