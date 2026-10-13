// Reserved migration name: changing pass conditions must never rewrite historical
// outcomes. Migration 054 stores versioned policies; grade entries retain their
// saved outcome and policy snapshot. Keep up/down harmless on existing databases.
export async function up(_options: { context: unknown }) {}
export async function down(_options: { context: unknown }) {}
