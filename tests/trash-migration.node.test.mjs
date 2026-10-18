import { DatabaseSync } from "node:sqlite";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  rmdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
const names = [
  "0001_initial",
  "0002_operating_guards",
  "0003_rename_link_codes",
  "0004_admin_directory_indexes",
  "0005_admin_trash",
];
const sql = (name) =>
  readFileSync(new URL(`../migrations/${name}.sql`, import.meta.url), "utf8");
test("trash migration preserves existing rows; backup restore retains deletion groups and guards", () => {
  const source = new DatabaseSync(":memory:"),
    restored = new DatabaseSync(":memory:");
  const dir = resolve(".local", `trash-restore-test-${process.pid}`),
    input = join(dir, "fixture.json"),
    output = join(dir, "restore.sql");
  mkdirSync(dir, { recursive: true });
  try {
    names.slice(0, 4).forEach((name) => source.exec(sql(name)));
    source.exec(`UPDATE policy SET automatic_level=0,metrics_at=1,last_backup_at=1,heartbeat=1;
      INSERT INTO users(id,email,name,created_at) VALUES('member','test@example.invalid','Local user',1);
      INSERT INTO links(slug,owner_id,target,created_at,last_access_at,idle_expires_at,months) VALUES('sample','member','https://example.com',1,1,999999,12);
      INSERT INTO analytics VALUES('sample','2026-10-18','Zalo','Máy tính',2);`);
    const before = source
      .prepare("SELECT slug,target,status,owner_id FROM links")
      .all();
    source.exec(sql(names[4]));
    assert.deepEqual(
      source.prepare("SELECT slug,target,status,owner_id FROM links").all(),
      before,
    );
    assert.equal(
      source.prepare("SELECT clicks FROM analytics").get().clicks,
      2,
    );
    source.exec("UPDATE users SET deleted_at=1000 WHERE id='member'");
    const tables = Object.fromEntries(
      ["users", "links", "blocked_targets", "policy"].map((name) => [
        name,
        source.prepare(`SELECT * FROM ${name}`).all(),
      ]),
    );
    writeFileSync(input, JSON.stringify({ version: 1, tables }));
    execFileSync(process.execPath, ["scripts/restore.mjs", input, output], {
      stdio: "pipe",
    });
    names.forEach((name) => restored.exec(sql(name)));
    restored.exec(readFileSync(output, "utf8"));
    assert.deepEqual(
      restored.prepare("SELECT * FROM users").all(),
      source.prepare("SELECT * FROM users").all(),
    );
    assert.deepEqual(
      restored.prepare("SELECT * FROM links").all(),
      source.prepare("SELECT * FROM links").all(),
    );
    assert.deepEqual(restored.prepare("PRAGMA foreign_key_check").all(), []);
    assert.throws(
      () =>
        restored.exec("INSERT INTO sessions VALUES('fake','member',999999)"),
      /account:deleted/,
    );
    restored.exec("UPDATE users SET deleted_at=NULL WHERE id='member'");
    assert.equal(
      restored.prepare("SELECT status FROM links WHERE slug='sample'").get()
        .status,
      "active",
    );
    // Restoring must retain the migration-0003 rename exception for tombstones.
    restored.exec("UPDATE links SET slug='renamed' WHERE slug='sample'");
    assert.equal(
      restored.prepare("SELECT status FROM links WHERE slug='sample'").get()
        .status,
      "deleted",
    );
  } finally {
    source.close();
    restored.close();
    for (const path of [input, output]) {
      try {
        unlinkSync(path);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    rmdirSync(dir);
  }
});
