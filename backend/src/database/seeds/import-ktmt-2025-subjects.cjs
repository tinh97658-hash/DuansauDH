// Preview: node src/database/seeds/import-ktmt-2025-subjects.cjs
// Apply:   node src/database/seeds/import-ktmt-2025-subjects.cjs --apply
const { importSubjectCatalog } = require('./import-dtvt-2025-subjects.cjs');
importSubjectCatalog(require('./ktmt-2025-subjects.json'), 'ktmt-2025-subjects.json')
  .catch(error => { console.error(error.message); process.exitCode = 1; });
