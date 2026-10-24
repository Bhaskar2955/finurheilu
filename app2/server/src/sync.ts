/**
 * Copy the current Liiga season (games, results, standings) from liiga.fi into Appwrite.
 *   cd app2/server && npm run sync
 * The API server also does this automatically every DATA_TTL_MINUTES while it runs.
 */
import "./env.js";
import { appwriteReady, saveBundle } from "./appwrite.js";
import { fetchSeason } from "./liiga.js";

async function main() {
  if (!appwriteReady()) {
    console.error("Appwrite is not configured. Fill in app2/server/.env first (see README).");
    process.exit(1);
  }
  console.log("Fetching Liiga data from liiga.fi …");
  const b = await fetchSeason();
  console.log(`  ${b.games.length} upcoming games, ${b.results.length} results, ${b.stand.length} teams (season ${b.season})`);
  console.log("Writing to Appwrite …");
  const n = await saveBundle(b);
  console.log(`✓ ${n} rows saved. Open your Appwrite console → Databases → FinUrheilu to see them.`);
}

main().catch((e) => {
  console.error("Sync failed:", e?.message ?? e);
  process.exit(1);
});
