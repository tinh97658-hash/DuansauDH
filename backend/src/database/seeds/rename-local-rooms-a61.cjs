// Preview: node src/database/seeds/rename-local-rooms-a61.cjs
// Apply the reviewed mapping: append --apply. Room IDs and scheduling links remain intact.
const path = require("node:path");
const fs = require("node:fs");
const { Client } = require("pg");
process.loadEnvFile(path.resolve(__dirname, "../../../../.env"));
const apply = process.argv.includes("--apply");
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  database: process.env.POSTGRES_DB, user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000 });

async function run() {
  if (!["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST) || process.env.NODE_ENV === "production") {
    throw new Error("This script only updates the local development database.");
  }
  await client.connect();
  await client.query("BEGIN");
  try {
    await client.query("LOCK TABLE rooms IN SHARE ROW EXCLUSIVE MODE");
    const rooms = (await client.query("SELECT id, code, name FROM rooms ORDER BY code")).rows;
    const mapping = rooms.flatMap(room => {
      const match = room.code.match(/^BTDEMO26P(\d+)$/);
      const number = match ? Number(match[1]) : room.code === "DEV-SCHED-P301" ? 13 : null;
      return number === null ? [] : [{ ...room, newCode: `A61P${String(number).padStart(2, "0")}`, newName: `Phòng ${number}` }];
    });
    for (const room of mapping) {
      if (rooms.some(other => other.id !== room.id && other.code === room.newCode)) throw new Error(`Code already exists: ${room.newCode}`);
    }
    console.log(JSON.stringify(mapping, null, 2));
    if (apply && mapping.length) {
      const directory = path.resolve(__dirname, "../../../../docs/data-changes");
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, `rooms-a61-${Date.now()}.json`), JSON.stringify(mapping, null, 2), { flag: "wx" });
      for (const room of mapping) {
        await client.query("UPDATE rooms SET code=$1, name=$2, updated_at=NOW() WHERE id=$3", [room.newCode, room.newName, room.id]);
      }
      const result = (await client.query("SELECT code,name FROM rooms ORDER BY code")).rows;
      await client.query("COMMIT");
      console.log(JSON.stringify({ updated: mapping.length, rooms: result }, null, 2));
    } else {
      await client.query("ROLLBACK");
      console.log(apply ? "No matching rooms to update." : "Preview only.");
    }
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { await client.end(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
