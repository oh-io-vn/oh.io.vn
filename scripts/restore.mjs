// Produces a parameter-free SQL file for an EMPTY, isolated restore database.
// No automatic production restore. Keep output under the ignored .local/ directory.
import { readFile, writeFile } from "node:fs/promises";
import { validateBackup } from "./backup.mjs";
const data = validateBackup(
  JSON.parse(await readFile(process.argv[2], "utf8")),
);
const allowed = {
  users: ["id", "email", "name", "blocked", "created_at", "deleted_at"],
  links: [
    "slug",
    "owner_id",
    "target",
    "host",
    "label",
    "created_at",
    "last_access_at",
    "idle_expires_at",
    "no_idle_expiry",
    "fixed_expires_at",
    "months",
    "status",
    "creator_key",
    "deleted_at",
    "deletion_previous_status",
    "deletion_user_id",
  ],
  blocked_targets: ["kind", "value"],
  policy: [
    "id",
    "create_enabled",
    "guest_enabled",
    "analytics_enabled",
    "guest_limit",
    "user_limit",
    "active_limit",
    "global_limit",
    "expiry_hold",
    "heartbeat",
    "admin_sub",
    "monitoring",
    "updated_at",
  ],
};
const sqlValue = (v) =>
  v == null
    ? "NULL"
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "'" + String(v).replaceAll("'", "''") + "'";
let sql =
  "DROP TRIGGER IF EXISTS enforce_creation;\nDROP TRIGGER IF EXISTS record_creation;\nDROP TRIGGER IF EXISTS operating_guards;\n";
for (const table of ["users", "links", "blocked_targets", "policy"])
  for (const row of data.tables[table]) {
    const columns = allowed[table];
    sql += `INSERT OR REPLACE INTO ${table}(${columns.join(",")}) VALUES(${columns.map((c) => sqlValue(c === "no_idle_expiry" ? (row[c] ?? 0) : row[c])).join(",")});\n`;
  }
// Force preservation and disable creates until the operator finishes validation.
sql +=
  "UPDATE policy SET expiry_hold=1,create_enabled=0,heartbeat=0,monitoring=NULL WHERE id=1;\nDELETE FROM sessions;\nDELETE FROM creation_events;\n";
const migration = await readFile(
  new URL("../migrations/0006_admin_no_idle_expiry.sql", import.meta.url),
  "utf8",
);
sql += migration.slice(migration.indexOf("CREATE TRIGGER enforce_creation"));
await writeFile(process.argv[3], sql);
console.log("Restore SQL prepared for an isolated empty database.");
