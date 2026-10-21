/**
 * 063 — NHẬT KÝ THAY ĐỔI DỮ LIỆU (DB CHANGE LOG)
 *
 * Mục tiêu: ghi lại MỌI thay đổi dữ liệu ở tầng cơ sở dữ liệu để truy vết đầy đủ,
 * bất kể luồng code nào thực hiện (service, SQL thủ công, seed…).
 *
 * 1. Bảng `db_change_logs`: mỗi dòng = 1 thao tác INSERT/UPDATE/DELETE trên 1 bảng,
 *    lưu khóa chính, dữ liệu cũ/mới (JSONB), danh sách cột thay đổi và ngữ cảnh
 *    người thực hiện (actor, request id, IP, user-agent).
 * 2. Hàm trigger `audit_capture()` gắn vào mọi bảng nghiệp vụ dạng bảng thường.
 * 3. Người thực hiện được lấy từ biến phiên PostgreSQL `app.actor_staff_id`… do tầng
 *    ứng dụng set trong mỗi transaction (best-effort). Nếu không có ngữ cảnh, actor = NULL.
 *
 * Bảng loại trừ: bảng nhật ký, nhật ký thao tác tài khoản, phiên đăng nhập và metadata migration.
 */
import { DataTypes, QueryTypes } from "sequelize";

const TRIGGER_NAME = "audit_capture_trg";
const FUNCTION_NAME = "audit_capture";
/** Các bảng không ghi vết (tránh đệ quy và nhiễu). */
const EXCLUDED_TABLES = ["db_change_logs", "auth_audit_logs", "sessions", "sequelize_meta"];

const CAPTURE_FUNCTION = `
CREATE OR REPLACE FUNCTION ${FUNCTION_NAME}() RETURNS trigger AS $$
DECLARE
  pk_cols text[];
  old_json jsonb;
  new_json jsonb;
  pk_json jsonb;
  changed_cols text[];
  actor_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    old_json := to_jsonb(OLD);
  ELSIF (TG_OP = 'INSERT') THEN
    new_json := to_jsonb(NEW);
  ELSE
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    SELECT array_agg(e.key ORDER BY e.key) INTO changed_cols
    FROM jsonb_each(new_json) AS e
    WHERE old_json -> e.key IS DISTINCT FROM new_json -> e.key;
  END IF;

  SELECT array_agg(a.attname ORDER BY a.attnum) INTO pk_cols
  FROM pg_index i
  JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
  WHERE i.indrelid = TG_RELID AND i.indisprimary;

  IF pk_cols IS NOT NULL THEN
    IF (TG_OP = 'DELETE') THEN
      SELECT jsonb_object_agg(k, old_json -> k) INTO pk_json FROM unnest(pk_cols) AS k;
    ELSE
      SELECT jsonb_object_agg(k, new_json -> k) INTO pk_json FROM unnest(pk_cols) AS k;
    END IF;
  END IF;

  -- Không để lỗi ép kiểu actor làm hỏng giao dịch nghiệp vụ.
  BEGIN
    actor_id := NULLIF(current_setting('app.actor_staff_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    actor_id := NULL;
  END;

  INSERT INTO db_change_logs (
    table_name, operation, row_pk, old_data, new_data, changed_columns,
    actor_staff_id, actor_email, request_id, ip, user_agent, changed_at
  ) VALUES (
    TG_TABLE_NAME, TG_OP, pk_json::text, old_json, new_json, changed_cols,
    actor_id,
    NULLIF(current_setting('app.actor_email', true), ''),
    NULLIF(current_setting('app.request_id', true), ''),
    NULLIF(current_setting('app.ip', true), ''),
    NULLIF(current_setting('app.user_agent', true), ''),
    now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
`;

const selectAuditedTables = (excludeList: boolean) => `
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ${excludeList ? "AND c.relname NOT IN (:excluded)" : ""}
  ORDER BY c.relname;
`;

export async function up({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    await qi.createTable(
      "db_change_logs",
      {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        table_name: { type: DataTypes.STRING(80), allowNull: false },
        operation: { type: DataTypes.STRING(10), allowNull: false },
        row_pk: { type: DataTypes.TEXT, allowNull: true },
        old_data: { type: DataTypes.JSONB, allowNull: true },
        new_data: { type: DataTypes.JSONB, allowNull: true },
        changed_columns: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        actor_staff_id: { type: DataTypes.UUID, allowNull: true },
        actor_email: { type: DataTypes.STRING(150), allowNull: true },
        request_id: { type: DataTypes.STRING(64), allowNull: true },
        ip: { type: DataTypes.STRING(64), allowNull: true },
        user_agent: { type: DataTypes.TEXT, allowNull: true },
        changed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      },
      { transaction },
    );
    await qi.addIndex("db_change_logs", ["changed_at"], { name: "db_change_logs_changed_idx", transaction });
    await qi.addIndex("db_change_logs", ["table_name"], { name: "db_change_logs_table_idx", transaction });
    await qi.addIndex("db_change_logs", ["operation"], { name: "db_change_logs_operation_idx", transaction });
    await qi.addIndex("db_change_logs", ["actor_staff_id"], { name: "db_change_logs_actor_idx", transaction });

    await qi.sequelize.query(CAPTURE_FUNCTION, { transaction });

    const tables = (await qi.sequelize.query(selectAuditedTables(true), {
      replacements: { excluded: EXCLUDED_TABLES },
      type: QueryTypes.SELECT,
      transaction,
    })) as Array<{ relname: string }>;

    for (const { relname } of tables) {
      await qi.sequelize.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON "${relname}"`, { transaction });
      await qi.sequelize.query(
        `CREATE TRIGGER ${TRIGGER_NAME} AFTER INSERT OR UPDATE OR DELETE ON "${relname}" ` +
          `FOR EACH ROW EXECUTE FUNCTION ${FUNCTION_NAME}()`,
        { transaction },
      );
    }
  });
}

export async function down({ context: qi }: any) {
  await qi.sequelize.transaction(async (transaction: any) => {
    const tables = (await qi.sequelize.query(selectAuditedTables(false), {
      type: QueryTypes.SELECT,
      transaction,
    })) as Array<{ relname: string }>;

    for (const { relname } of tables) {
      await qi.sequelize.query(`DROP TRIGGER IF EXISTS ${TRIGGER_NAME} ON "${relname}"`, { transaction });
    }
    await qi.sequelize.query(`DROP FUNCTION IF EXISTS ${FUNCTION_NAME}()`, { transaction });
    await qi.dropTable("db_change_logs", { transaction });
  });
}
