// Preview: node src/database/seeds/import-qlsxcn-2025-subjects.cjs
// Apply:   node src/database/seeds/import-qlsxcn-2025-subjects.cjs --apply
const { importSubjectCatalog } = require('./import-dtvt-2025-subjects.cjs');
importSubjectCatalog(require('./qlsxcn-2025-subjects.json'), 'qlsxcn-2025-subjects.json')
  .catch(error => { console.error(error.message); process.exitCode = 1; });
