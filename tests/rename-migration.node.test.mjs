import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("rename migration preserves existing analytics and reserves old codes atomically", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of ["0001_initial", "0002_operating_guards"])
      db.exec(
        readFileSync(
          new URL(`../migrations/${name}.sql`, import.meta.url),
          "utf8",
        ),
      );
    db.exec(`UPDATE policy SET automatic_level=0,metrics_at=1,last_backup_at=1;
      INSERT INTO users VALUES('owner','owner@example.invalid','Owner',0,1);
      INSERT INTO links(slug,owner_id,target,created_at,last_access_at,idle_expires_at,months)
      VALUES('before','owner','https://example.com',1,1,999999,12);
      INSERT INTO analytics VALUES('before','2026-10-18','Zalo','Máy tính',8);`);
    const snapshot = db.prepare("SELECT * FROM analytics").all();
    db.exec(
      readFileSync(
        new URL("../migrations/0003_rename_link_codes.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(db.prepare("SELECT * FROM analytics").all(), snapshot);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.exec("UPDATE links SET slug='after' WHERE slug='before'");
    assert.equal(
      db.prepare("SELECT clicks FROM analytics WHERE slug='after'").get()
        .clicks,
      8,
    );
    assert.equal(
      db.prepare("SELECT status FROM links WHERE slug='before'").get().status,
      "deleted",
    );
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM creation_events").get().n,
      1,
    );
    // Failure in the reservation must roll back both parent and FK cascade.
    db.exec(`CREATE TRIGGER fail_reservation BEFORE INSERT ON links
      WHEN NEW.slug='after' BEGIN SELECT RAISE(ABORT,'test rollback'); END;`);
    assert.throws(
      () => db.exec("UPDATE links SET slug='third' WHERE slug='after'"),
      /test rollback/,
    );
    assert.equal(db.prepare("SELECT slug FROM analytics").get().slug, "after");
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM links WHERE slug='third'").get().n,
      0,
    );
  } finally {
    db.close();
  }
});
