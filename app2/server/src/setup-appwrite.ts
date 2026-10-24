/**
 * One-time setup: creates the database, tables, columns and indexes in your Appwrite project.
 * Safe to run again: anything that already exists is skipped.
 *
 *   cd app2/server && npm run setup:appwrite
 */
import "./env.js";
import { Permission, Role, TablesDBIndexType } from "node-appwrite";
import { APPWRITE, T_GAMES, T_META, T_PROFILES, T_STAND, appwriteReady, tables } from "./appwrite.js";

type Col =
  | { kind: "varchar"; key: string; size: number; required?: boolean }
  | { kind: "int"; key: string; required?: boolean }
  | { kind: "longtext"; key: string; required?: boolean };

const TABLES: { id: string; name: string; permissions: string[]; rowSecurity: boolean; cols: Col[]; indexes: [string, string[]][] }[] = [
  {
    id: T_GAMES, name: "Liiga games", permissions: [Permission.read(Role.any())], rowSecurity: false,
    cols: [
      { kind: "int", key: "liiga_id", required: true },
      { kind: "varchar", key: "kind", size: 10, required: true },
      { kind: "varchar", key: "date", size: 10, required: true },
      { kind: "varchar", key: "time", size: 5 },
      { kind: "varchar", key: "home", size: 40, required: true },
      { kind: "varchar", key: "away", size: 40, required: true },
      { kind: "int", key: "home_goals" },
      { kind: "int", key: "away_goals" },
      { kind: "varchar", key: "decided", size: 2 },
      { kind: "int", key: "season", required: true },
    ],
    indexes: [["by_season", ["season"]], ["by_date", ["date"]]],
  },
  {
    id: T_STAND, name: "Liiga standings", permissions: [Permission.read(Role.any())], rowSecurity: false,
    cols: [
      { kind: "varchar", key: "team", size: 40, required: true },
      { kind: "int", key: "rank", required: true },
      { kind: "int", key: "games", required: true },
      { kind: "int", key: "points", required: true },
      { kind: "int", key: "season", required: true },
    ],
    indexes: [["by_season", ["season"]], ["by_rank", ["rank"]]],
  },
  {
    id: T_META, name: "Liiga sync info", permissions: [Permission.read(Role.any())], rowSecurity: false,
    cols: [
      { kind: "varchar", key: "fetched_at", size: 40, required: true },
      { kind: "int", key: "season", required: true },
      { kind: "varchar", key: "source", size: 40 },
      { kind: "int", key: "games" },
    ],
    indexes: [],
  },
  {
    // Signed-in users can create their own row; each row is readable/writable only by its owner.
    id: T_PROFILES, name: "User profiles", permissions: [Permission.create(Role.users())], rowSecurity: true,
    cols: [
      { kind: "varchar", key: "user_id", size: 36, required: true },
      { kind: "longtext", key: "prefs", required: true },
    ],
    indexes: [],
  },
];

const exists = (e: unknown) => (e as { code?: number })?.code === 409;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!appwriteReady()) {
    console.error("Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY in app2/server/.env first.");
    process.exit(1);
  }
  const db = tables();
  const databaseId = APPWRITE.db;

  try {
    await db.create({ databaseId, name: "FinUrheilu" });
    console.log(`✓ database "${databaseId}" created`);
  } catch (e) {
    if (!exists(e)) throw e;
    console.log(`• database "${databaseId}" already exists`);
  }

  for (const t of TABLES) {
    try {
      await db.createTable({ databaseId, tableId: t.id, name: t.name, permissions: t.permissions, rowSecurity: t.rowSecurity });
      console.log(`✓ table ${t.id}`);
    } catch (e) {
      if (!exists(e)) throw e;
      console.log(`• table ${t.id} already exists`);
    }
    for (const c of t.cols) {
      const base = { databaseId, tableId: t.id, key: c.key, required: !!c.required };
      try {
        if (c.kind === "varchar") await db.createVarcharColumn({ ...base, size: c.size });
        else if (c.kind === "int") await db.createIntegerColumn(base);
        else await db.createLongtextColumn(base);
        console.log(`  ✓ column ${c.key}`);
      } catch (e) {
        if (!exists(e)) throw e;
      }
    }
    // Columns are created in the background; indexes need them to be ready.
    for (let i = 0; i < 30; i++) {
      const cols = await db.listColumns({ databaseId, tableId: t.id });
      if ((cols.columns as { status?: string }[]).every((c) => c.status === "available")) break;
      await sleep(1000);
    }
    for (const [key, columns] of t.indexes) {
      try {
        await db.createIndex({ databaseId, tableId: t.id, key, type: TablesDBIndexType.Key, columns });
        console.log(`  ✓ index ${key}`);
      } catch (e) {
        if (!exists(e)) throw e;
      }
    }
  }
  console.log("\nAppwrite is ready. Next: npm run sync  (copies Liiga data into Appwrite)");
}

main().catch((e) => {
  console.error("Setup failed:", e?.message ?? e);
  process.exit(1);
});
