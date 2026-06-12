import crypto from "node:crypto";
import { getDb, closeMongoClient } from "./db.js";
import env from "./config/env.js";
import { embedTexts } from "./services/embeddings.js";
import {
  HIGH_SEVERITY_MESSAGES,
  NORMAL_MESSAGES,
  RUNBOOK_CHUNKS,
  TOWER_SITES
} from "./data/catalog.js";
import { refreshTowerHealth } from "./services/towerHealth.js";

async function ensureManualsVectorIndex(db) {
  const collection = db.collection("manuals");
  const indexes = await collection.listSearchIndexes().toArray();
  const existing = indexes.find((index) => index.name === env.manualsVectorIndex);

  if (!existing) {
    await collection.createSearchIndex({
      name: env.manualsVectorIndex,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: env.voyageEmbeddingDimensions,
            similarity: "cosine"
          }
        ]
      }
    });
  }

  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const current = await collection.listSearchIndexes().toArray();
    const match = current.find((index) => index.name === env.manualsVectorIndex);
    if (match?.status === "READY" && match.queryable !== false) {
      return env.manualsVectorIndex;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error(
    `Vector search index "${env.manualsVectorIndex}" is not READY yet. Wait a minute and run seed again.`
  );
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("tower_sites").createIndex({ towerId: 1 }, { unique: true }),
    db.collection("tower_sites").createIndex({ location: "2dsphere" }),
    db.collection("tower_health").createIndex({ towerId: 1 }, { unique: true }),
    db.collection("tower_health").createIndex({ status: 1 }),
    db.collection("realtime_network_logs").createIndex({ event_timestamp: -1 }),
    db.collection("realtime_network_logs").createIndex({ source_tower_id: 1, event_timestamp: -1 }),
    db.collection("realtime_network_logs").createIndex({ severity: -1 }),
    db.collection("manuals").createIndex({ alertType: 1 }),
    db.collection("chat_messages").createIndex({ sessionId: 1, createdAt: -1 })
  ]);
}

function buildManualDocuments() {
  return RUNBOOK_CHUNKS.map((chunk) => ({
    ...chunk,
    searchableText: [
      chunk.title,
      chunk.alertType,
      ...(chunk.probableCauses ?? []),
      ...(chunk.remediationSteps ?? [])
    ].join(" ")
  }));
}

async function seedRecentLogs(db) {
  const now = Date.now();
  const documents = [];

  for (const site of TOWER_SITES) {
    const isBadTower = site.towerId === "tower_2" || site.towerId === "tower_7";
    const count = isBadTower ? 8 : 3;

    for (let index = 0; index < count; index += 1) {
      documents.push({
        source_tower_id: site.towerId,
        event_id: crypto.randomUUID(),
        event_description: isBadTower
          ? HIGH_SEVERITY_MESSAGES[index % HIGH_SEVERITY_MESSAGES.length]
          : NORMAL_MESSAGES[index % NORMAL_MESSAGES.length],
        category: isBadTower ? "SymmetricDS" : "STAT",
        severity: isBadTower ? 4 + (index % 2) : index % 3,
        event_timestamp: new Date(now - index * 15_000)
      });
    }
  }

  await db.collection("realtime_network_logs").insertMany(documents);
  return documents.length;
}

export async function seedDatabase({ reset = false, indexesOnly = false } = {}) {
  const db = await getDb();
  await ensureIndexes(db);

  if (indexesOnly) {
    return { indexesOnly: true };
  }

  if (reset) {
    await Promise.all([
      db.collection("tower_sites").deleteMany({}),
      db.collection("tower_health").deleteMany({}),
      db.collection("realtime_network_logs").deleteMany({}),
      db.collection("manuals").deleteMany({}),
      db.collection("chat_messages").deleteMany({})
    ]);
  }

  const existingSites = await db.collection("tower_sites").countDocuments();
  if (existingSites === 0 || reset) {
    await db.collection("tower_sites").deleteMany({});
    await db.collection("tower_sites").insertMany(
      TOWER_SITES.map((site) => ({
        ...site,
        createdAt: new Date().toISOString()
      }))
    );
  }

  const existingManuals = await db.collection("manuals").countDocuments();
  if (existingManuals === 0 || reset) {
    const manuals = buildManualDocuments();
    const embeddings = await embedTexts(
      manuals.map((manual) => manual.searchableText),
      "document"
    );

    if (!embeddings || embeddings.length !== manuals.length) {
      throw new Error("Voyage embeddings are required to seed manuals with vectors.");
    }

    await db.collection("manuals").deleteMany({});
    await db.collection("manuals").insertMany(
      manuals.map((manual, index) => ({
        ...manual,
        embedding: embeddings[index]
      }))
    );
  }

  const manualsWithEmbeddings = await db.collection("manuals").countDocuments({
    embedding: { $type: "array" }
  });
  if (manualsWithEmbeddings === 0) {
    throw new Error("Manuals are missing embeddings. Re-run seed with --reset after VOYAGE_API_KEY is configured.");
  }

  const existingLogs = await db.collection("realtime_network_logs").countDocuments();
  if (existingLogs === 0 || reset) {
    await db.collection("realtime_network_logs").deleteMany({});
    await seedRecentLogs(db);
  }

  await db.collection("demo_settings").updateOne(
    { _id: "ui" },
    {
      $setOnInsert: {
        atlasChartsTowerMapEmbedUrl: "",
        atlasChartsTowerDashboardEmbedUrl: "",
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );

  await refreshTowerHealth(db);

  await ensureManualsVectorIndex(db);

  await db.collection("tower_health").bulkWrite([
    {
      updateOne: {
        filter: { towerId: "tower_2" },
        update: {
          $set: {
            towerId: "tower_2",
            maxSeverity: 5,
            openAlertCount: 8,
            status: "critical",
            mapColor: "red",
            lastDescription: HIGH_SEVERITY_MESSAGES[0],
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    },
    {
      updateOne: {
        filter: { towerId: "tower_7" },
        update: {
          $set: {
            towerId: "tower_7",
            maxSeverity: 4,
            openAlertCount: 6,
            status: "degraded",
            mapColor: "red",
            lastDescription: HIGH_SEVERITY_MESSAGES[1],
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    }
  ]);

  return {
    towerSites: await db.collection("tower_sites").countDocuments(),
    manuals: await db.collection("manuals").countDocuments(),
    logs: await db.collection("realtime_network_logs").countDocuments(),
    vectorIndex: env.manualsVectorIndex
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reset = process.argv.includes("--reset");
  const indexesOnly = process.argv.includes("--indexes-only");

  seedDatabase({ reset, indexesOnly })
    .then((result) => {
      console.log("[seed] completed", result);
    })
    .catch((error) => {
      console.error("[seed] failed", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeMongoClient();
    });
}
