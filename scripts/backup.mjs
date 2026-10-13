import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
// Run with DATABASE_FILE set to the same path as your live service.
const source = path.resolve(
  process.env.DATABASE_FILE || "server/data/marginmind.db",
);
const output = path.resolve(
  process.argv[2] ||
    path.join("backups", new Date().toISOString().replace(/[:.]/g, "-")),
);
if (!fs.existsSync(source))
  throw Error(
    "Database not found. Set DATABASE_FILE to your live database path.",
  );
if (fs.existsSync(output))
  throw Error(
    "Choose a new backup directory; existing backups are never overwritten.",
  );
fs.mkdirSync(output, { recursive: true });
async function copy(file, target) {
  const db = new Database(file, { readonly: true });
  try {
    await db.backup(target);
  } finally {
    db.close();
  }
}
await copy(source, path.join(output, "marginmind.db"));
const restaurants = path.join(path.dirname(source), "restaurants");
if (fs.existsSync(restaurants)) {
  fs.mkdirSync(path.join(output, "restaurants"));
  for (const f of fs.readdirSync(restaurants).filter((f) => f.endsWith(".db")))
    await copy(path.join(restaurants, f), path.join(output, "restaurants", f));
}
console.log(
  "SQLite snapshots saved to " +
    output +
    ". Keep this folder private and copy it off the hosting service.",
);
