// Legacy files are indexed lazily on each account's first upload. Keep orphan
// files in the accounting until they have actually been removed from disk.
export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.sequelize.query(`CREATE TABLE upload_storage_accounts (
      account_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE upload_storage_files (
      account_id uuid NOT NULL REFERENCES upload_storage_accounts(account_id) ON DELETE CASCADE,
      kind text NOT NULL CHECK (kind IN ('photo','submission')),
      filename text NOT NULL,
      size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
      PRIMARY KEY(account_id,kind,filename)
    );`, { transaction });
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.query('DROP TABLE upload_storage_files; DROP TABLE upload_storage_accounts;');
}
