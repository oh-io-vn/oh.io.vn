import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encryptBackup,
  decryptBackup,
  validateBackup,
} from "../scripts/backup.mjs";
test("encrypted backup authenticates, round-trips and rejects tampering", () => {
  const key = randomBytes(32).toString("hex"),
    data = {
      version: 1,
      tables: {
        users: [{ id: "u" }],
        links: [
          { slug: "abc", owner_id: "u", target: "https://example.com/?x='" },
        ],
        policy: [{ id: 1 }],
        blocked_targets: [],
      },
    };
  const bytes = encryptBackup(data, key);
  assert.deepEqual(validateBackup(decryptBackup(bytes, key)), data);
  const bad = Buffer.from(bytes);
  bad[bad.length - 1] ^= 1;
  assert.throws(() => decryptBackup(bad, key));
  assert.throws(() => decryptBackup(bytes, randomBytes(32).toString("hex")));
  assert.throws(() =>
    validateBackup({ ...data, tables: { ...data.tables, users: [] } }),
  );
});
