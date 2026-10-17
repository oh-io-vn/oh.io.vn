import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export function encryptBackup(value, key) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  const compressed = gzipSync(Buffer.from(JSON.stringify(value)));
  const body = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return Buffer.concat([Buffer.from("OHBK01"), iv, cipher.getAuthTag(), body]);
}
export function decryptBackup(bytes, key) {
  if (bytes.subarray(0, 6).toString() !== "OHBK01")
    throw new Error("Unsupported backup");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "hex"),
    bytes.subarray(6, 18),
  );
  decipher.setAuthTag(bytes.subarray(18, 34));
  return JSON.parse(
    gunzipSync(
      Buffer.concat([decipher.update(bytes.subarray(34)), decipher.final()]),
    ).toString(),
  );
}
export function validateBackup(data) {
  if (
    data.version !== 1 ||
    !data.tables ||
    !["links", "users", "blocked_targets", "policy"].every((k) =>
      Array.isArray(data.tables[k]),
    )
  )
    throw new Error("Invalid backup schema");
  const ids = new Set(data.tables.users.map((u) => u.id));
  const slugs = new Set();
  for (const l of data.tables.links) {
    if (slugs.has(l.slug) || !l.slug || (l.owner_id && !ids.has(l.owner_id)))
      throw new Error("Invalid backup relationships");
    slugs.add(l.slug);
  }
  return data;
}
async function main() {
  const mode = process.argv[2] ?? "create";
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/.test(key))
    throw new Error("Missing 256-bit backup key");
  if (mode === "decrypt") {
    const value = validateBackup(
      decryptBackup(await readFile(process.argv[3]), key),
    );
    await writeFile(process.argv[4], JSON.stringify(value));
    console.log("Backup authenticated, decrypted and validated.");
    return;
  }
  const token = process.env.BACKUP_TOKEN,
    origin = process.env.BACKUP_ORIGIN;
  if (!token || !origin?.startsWith("https://"))
    throw new Error("Missing backup source");
  if (mode === "ack") {
    const r = await fetch(origin + "/api/internal/backup-complete", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) throw new Error("Backup acknowledgement failed");
    console.log("Private upload acknowledged.");
    return;
  }
  const response = await fetch(origin + "/api/internal/backup", {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok)
    throw new Error("Backup endpoint returned " + response.status);
  const raw = await response.text();
  if (Buffer.byteLength(raw) > 2 * 1024 * 1024)
    throw new Error(
      "Plaintext backup exceeds pilot 2 MiB cap; adjust storage budget before increasing",
    );
  const value = validateBackup(JSON.parse(raw));
  const encrypted = encryptBackup(value, key);
  // Verify the bytes before uploading. No plaintext is written to disk in the scheduled job.
  validateBackup(decryptBackup(encrypted, key));
  await mkdir("backups", { recursive: true });
  await writeFile(
    "backups/" + new Date().toISOString().slice(0, 10) + ".ohbk",
    encrypted,
  );
  console.log(
    "Encrypted backup verified. Compressed bytes: " +
      encrypted.length +
      "; links: " +
      value.tables.links.length,
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
