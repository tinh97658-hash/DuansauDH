import type { QueryInterface } from 'sequelize';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.transaction(async transaction => {
    // Historical paid rows deliberately keep a NULL date: it cannot be inferred.
    await qi.sequelize.query(`ALTER TABLE lecturer_payments
      ADD COLUMN payment_date date,
      ADD COLUMN note text NOT NULL DEFAULT '',
      ADD CONSTRAINT lecturer_payments_note_length CHECK (char_length(note) <= 2000),
      ADD CONSTRAINT lecturer_payments_unpaid_date CHECK (paid OR payment_date IS NULL);
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger
          WHERE tgrelid='lecturer_payments'::regclass AND tgname='audit_capture_trg') THEN
          CREATE TRIGGER audit_capture_trg AFTER INSERT OR UPDATE OR DELETE ON lecturer_payments
            FOR EACH ROW EXECUTE FUNCTION audit_capture();
        END IF;
      END $$;`, { transaction });
  });
}

export async function down() {
  throw new Error('Không tự động xóa ngày thanh toán và ghi chú. Hãy sao lưu trước khi gỡ các trường này.');
}
