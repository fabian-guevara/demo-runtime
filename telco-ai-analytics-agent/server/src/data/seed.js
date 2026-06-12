import { getDb, closeMongoClient } from "../config/db.js";
import { generateSampleData } from "./sampleData.js";
import { ensureMongoIndexes } from "../mongo/indexes.js";
import { embedTexts } from "../services/embeddingService.js";
import logger from "../utils/logger.js";

async function attachEmbeddings(documents, textField) {
  if (!documents.length) {
    return documents;
  }

  const { embeddings, model } = await embedTexts({
    texts: documents.map((document) => document[textField]),
    inputType: "document"
  });

  return documents.map((document, index) => ({
    ...document,
    embedding: embeddings[index]
  }));
}

export async function seedDemoData() {
  const db = await getDb();
  const sample = generateSampleData();
  const supportInteractions = await attachEmbeddings(sample.supportInteractions, "summary");
  const incidentSummaries = await attachEmbeddings(sample.incidentSummaries, "summary");

  await Promise.all([
    db.collection("accounts").deleteMany({}),
    db.collection("usage_metrics").deleteMany({}),
    db.collection("support_interactions").deleteMany({}),
    db.collection("incident_summaries").deleteMany({}),
    db.collection("agent_checkpoints").deleteMany({}),
    db.collection("agent_memories").deleteMany({}),
    db.collection("demo_telemetry").deleteMany({})
  ]);

  await db.collection("accounts").insertMany(sample.accounts);
  await db.collection("usage_metrics").insertMany(sample.usageMetrics);
  await db.collection("support_interactions").insertMany(supportInteractions);
  await db.collection("incident_summaries").insertMany(incidentSummaries);
  await ensureMongoIndexes();

  logger.info("Seeded telco_ai_analytics_demo", {
    accounts: sample.accounts.length,
    usageMetrics: sample.usageMetrics.length,
    supportInteractions: supportInteractions.length,
    incidentSummaries: incidentSummaries.length,
    embeddingMode: "voyage-client-side"
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemoData()
    .catch((error) => {
      logger.error("Seed failed", {
        message: error.message
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeMongoClient();
    });
}
