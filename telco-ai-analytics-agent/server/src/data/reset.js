import { getDb, closeMongoClient } from "../config/db.js";
import { seedDemoData } from "./seed.js";
import logger from "../utils/logger.js";

export async function resetDemoData() {
  const db = await getDb();

  await Promise.all([
    db.collection("agent_checkpoints").deleteMany({}),
    db.collection("agent_memories").deleteMany({}),
    db.collection("demo_telemetry").deleteMany({})
  ]);

  await seedDemoData();
  logger.info("Reset demo data to story state");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  resetDemoData()
    .catch((error) => {
      logger.error("Reset failed", {
        message: error.message
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeMongoClient();
    });
}
