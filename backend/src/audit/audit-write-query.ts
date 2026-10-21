import { QueryTypes } from "sequelize";

const WRITE_TYPES = new Set<string>([
  QueryTypes.INSERT, QueryTypes.UPDATE, QueryTypes.BULKUPDATE,
  QueryTypes.DELETE, QueryTypes.BULKDELETE, QueryTypes.UPSERT,
]);
const EXCLUDED_TABLES = new Set(["db_change_logs", "auth_audit_logs", "sessions", "sequelize_meta"]);

/** SQL keywords outside literals, identifiers and comments. Raw DML can use
 * QueryTypes.SELECT for RETURNING, so the result type alone is insufficient. */
function keywords(sql: string): string[] {
  const words: string[] = [];
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith("--", i)) {
      const end = sql.indexOf("\n", i + 2);
      i = end < 0 ? sql.length : end + 1;
    } else if (sql.startsWith("/*", i)) {
      let depth = 1;
      i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith("/*", i)) { depth++; i += 2; }
        else if (sql.startsWith("*/", i)) { depth--; i += 2; }
        else i++;
      }
    } else if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      const escaped = quote === "'" && /[eE]/.test(sql[i - 1] || "") && !/[\w$]/.test(sql[i - 2] || "");
      i++;
      while (i < sql.length) {
        if (escaped && sql[i] === "\\") i += 2;
        else if (sql[i] === quote && sql[i + 1] === quote) i += 2;
        else if (sql[i++] === quote) break;
      }
    } else if (sql[i] === "$" && /^\$(?:[a-z_][a-z_0-9]*)?\$/i.test(sql.slice(i))) {
      const tag = /^\$(?:[a-z_][a-z_0-9]*)?\$/i.exec(sql.slice(i))![0];
      const end = sql.indexOf(tag, i + tag.length);
      i = end < 0 ? sql.length : end + tag.length;
    } else if (/[a-z_]/i.test(sql[i])) {
      const start = i++;
      while (i < sql.length && /[\w$]/.test(sql[i])) i++;
      words.push(sql.slice(start, i).toUpperCase());
    } else {
      if ("();".includes(sql[i])) words.push(sql[i]);
      i++;
    }
  }
  return words;
}

export function isAuditWrite(sql: any, options: any = {}): boolean {
  const table = options.model?.getTableName?.();
  if (EXCLUDED_TABLES.has(typeof table === "string" ? table : table?.tableName)) return false;
  if (WRITE_TYPES.has(options.type)) return true;
  const words = keywords(typeof sql === "string" ? sql : sql?.query || "");
  return words.some((word, index) =>
    (word === "INSERT" && words[index + 1] === "INTO") ||
    (word === "DELETE" && words[index + 1] === "FROM") ||
    (word === "MERGE" && words[index + 1] === "INTO") ||
    (word === "UPDATE" && words[index - 1] !== "FOR" && words[index - 1] !== "KEY"),
  );
}
