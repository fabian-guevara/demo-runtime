import { getDb, closeMongoClient } from "../config/db.js";
import env from "../config/env.js";
import logger from "../utils/logger.js";

export async function ensureMongoIndexes() {
  const db = await getDb();

  await Promise.all([
    db.collection("accounts").createIndex({ region: 1, segment: 1 }),
    db.collection("accounts").createIndex({ accountId: 1 }, { unique: true }),
    db.collection("usage_metrics").createIndex({ accountId: 1, month: -1 }),
    db.collection("usage_metrics").createIndex({ region: 1, segment: 1, month: -1 }),
    db.collection("support_interactions").createIndex({ accountId: 1, createdAt: -1 }),
    db.collection("incident_summaries").createIndex({ region: 1, createdAt: -1 }),
    db.collection("agent_checkpoints").createIndex({ conversationId: 1, updatedAt: -1 }),
    db.collection("agent_memories").createIndex({ namespace: 1, key: 1 }),
    db.collection("demo_telemetry").createIndex({ timestamp: -1 })
  ]);

  logger.info("Created standard MongoDB indexes", {
    db: env.mongodbDbName
  });
  logger.info("Vector Search indexes are defined under server/src/mongo/vectorIndexes/ and should be created in Atlas if your cluster supports them.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureMongoIndexes()
    .catch((error) => {
      logger.error("Failed to create indexes", {
        message: error.message
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeMongoClient();
    });
}
