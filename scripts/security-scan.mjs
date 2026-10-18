import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";

// The caller installs a verified local Gitleaks binary. No uploads or downloads.
const scanner = process.argv[2] || process.env.GITLEAKS_BIN || "gitleaks";
const root = resolve(".local/security");
mkdirSync(root, { recursive: true });
const snapshot = mkdtempSync(join(root, "worktree-"));
const files = spawnSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
);
if (files.status !== 0)
  throw new Error("Cannot enumerate repository files for secret scanning");
for (const file of new Set(files.stdout.split("\0").filter(Boolean))) {
  if (!existsSync(file) || !lstatSync(file).isFile()) continue;
  const target = resolve(snapshot, file);
  if (!target.startsWith(snapshot + sep))
    throw new Error("File outside scan snapshot");
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
}
const scans = [
  ["history", "git", ".", "--log-opts=--all"],
  ["worktree", "dir", snapshot],
  ...(existsSync("dist") ? [["dist", "dir", "dist"]] : []),
];
let failed = false;
for (const [name, ...args] of scans) {
  const result = spawnSync(
    scanner,
    [
      ...args,
      "--redact=100",
      "--ignore-gitleaks-allow",
      "--no-banner",
      "--no-color",
      "--report-format=json",
      `--report-path=${join(root, `gitleaks-${name}.json`)}`,
    ],
    { stdio: "inherit", timeout: 120000 },
  );
  if (result.error) {
    console.error(
      "Cannot run Gitleaks. Install the verified version documented in SECURITY.md, or pass its executable path.",
    );
    process.exit(1);
  }
  failed ||= result.status !== 0;
}
console.log(`Redacted scan reports: ${root}`);
process.exitCode = failed ? 1 : 0;
