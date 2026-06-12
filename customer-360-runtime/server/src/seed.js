import env from "./config/env.js";
import { CUSTOMERS_SEARCH_INDEX_DEFINITION } from "./config/customersSearchIndex.js";
import { embedTexts } from "./services/embeddings.js";
import { buildCustomerBatch, buildInteractionBatch } from "./data/customerGenerator.js";
import { CARE_KB_CHUNKS } from "./data/catalog.js";
import { getDb, closeMongoClient } from "./db.js";

const BATCH_SIZE = 10_000;

async function dropSeedCollections(db) {
  await Promise.all([
    db.collection("customers").deleteMany({}),
    db.collection("interactions").deleteMany({}),
    db.collection("care_kb").deleteMany({}),
    db.collection("chat_messages").deleteMany({}),
    db.collection("customer_stats").deleteMany({})
  ]);
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("customers").createIndex({ customerId: 1 }, { unique: true }),
    db.collection("customers").createIndex({ msisdn: 1 }),
    db.collection("customers").createIndex({ email: 1 }),
    db.collection("customers").createIndex({ segment: 1, market: 1 }),
    db.collection("customers").createIndex({ churnRisk: -1 }),
    db.collection("customers").createIndex({ status: 1 }),
    db.collection("customers").createIndex({ lastName: 1, firstName: 1 }),
    db.collection("interactions").createIndex({ customerId: 1, occurredAt: -1 }),
    db.collection("interactions").createIndex({ occurredAt: -1 }),
    db.collection("interactions").createIndex({ topic: 1 }),
    db.collection("care_kb").createIndex({ topic: 1 }),
    db.collection("chat_messages").createIndex({ sessionId: 1, createdAt: -1 })
  ]);
}

async function waitForSearchIndex(collection, indexName, timeoutMs = 600_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const current = await collection.listSearchIndexes().toArray();
    const match = current.find((index) => index.name === indexName);
    if (match?.status === "READY" && match.queryable !== false) {
      return indexName;
    }
    if (match?.status === "FAILED") {
      throw new Error(`Search index "${indexName}" failed to build.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(
    `Search index "${indexName}" is not READY yet. Large collections can take several minutes — run npm run indexes again.`
  );
}

async function ensureKbVectorIndex(db) {
  const collection = db.collection("care_kb");
  const indexes = await collection.listSearchIndexes().toArray();
  const existing = indexes.find((index) => index.name === env.kbVectorIndex);

  if (!existing) {
    await collection.createSearchIndex({
      name: env.kbVectorIndex,
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

  return waitForSearchIndex(collection, env.kbVectorIndex);
}

async function backfillSearchableNames(db) {
  const sample = await db.collection("customers").findOne({ searchableName: { $exists: false } });
  if (!sample) {
    return;
  }

  console.log("[seed] backfilling searchableName for Atlas Search...");
  await db.collection("customers").updateMany(
    { searchableName: { $exists: false } },
    [{ $set: { searchableName: { $concat: ["$firstName", " ", "$lastName"] } } }]
  );
}

async function dropSearchIndexIfExists(collection, indexName) {
  const indexes = await collection.listSearchIndexes().toArray();
  if (!indexes.some((index) => index.name === indexName)) {
    return;
  }

  await collection.dropSearchIndex(indexName);

  const started = Date.now();
  while (Date.now() - started < 120_000) {
    const current = await collection.listSearchIndexes().toArray();
    if (!current.some((index) => index.name === indexName)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timed out dropping search index "${indexName}".`);
}

async function ensureCustomersSearchIndex(db, { forceRebuild = false } = {}) {
  await backfillSearchableNames(db);
  const collection = db.collection("customers");
  const indexes = await collection.listSearchIndexes().toArray();
  const existing = indexes.find((index) => index.name === env.customersSearchIndex);

  if (existing && forceRebuild) {
    console.log(`[seed] rebuilding ${env.customersSearchIndex} for autocomplete...`);
    await dropSearchIndexIfExists(collection, env.customersSearchIndex);
  }

  const current = await collection.listSearchIndexes().toArray();
  if (!current.find((index) => index.name === env.customersSearchIndex)) {
    await collection.createSearchIndex({
      name: env.customersSearchIndex,
      type: "search",
      definition: CUSTOMERS_SEARCH_INDEX_DEFINITION
    });
  }

  return waitForSearchIndex(collection, env.customersSearchIndex);
}

function buildKbDocuments() {
  return CARE_KB_CHUNKS.map((chunk) => ({
    ...chunk,
    searchableText: [chunk.title, chunk.topic, chunk.summary, ...(chunk.guidance ?? [])].join(" ")
  }));
}

async function seedCustomers(db, totalCustomers) {
  const collection = db.collection("customers");
  const started = Date.now();
  let inserted = 0;

  for (let start = 1; start <= totalCustomers; start += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, totalCustomers - start + 1);
    const batch = buildCustomerBatch(start, batchSize);
    await collection.insertMany(batch, { ordered: false });
    inserted += batchSize;
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const rate = Math.round(inserted / Math.max(Number(elapsed), 1));
    console.log(`[seed] customers ${inserted.toLocaleString()} / ${totalCustomers.toLocaleString()} (${rate}/s)`);
  }

  return inserted;
}

async function seedInteractions(db, totalCustomers, interactionCount) {
  if (interactionCount <= 0) {
    return 0;
  }

  const collection = db.collection("interactions");
  const started = Date.now();
  let inserted = 0;

  for (let offset = 0; offset < interactionCount; offset += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, interactionCount - offset);
    const batch = buildInteractionBatch(totalCustomers, batchSize, offset, Date.now());
    await collection.insertMany(batch, { ordered: false });
    inserted += batchSize;
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`[seed] interactions ${inserted.toLocaleString()} / ${interactionCount.toLocaleString()} (${elapsed}s)`);
  }

  return inserted;
}

async function seedCareKb(db) {
  const documents = buildKbDocuments();
  const embeddings = await embedTexts(
    documents.map((document) => document.searchableText),
    "document"
  );

  if (!embeddings || embeddings.length !== documents.length) {
    throw new Error("Voyage embeddings are required to seed care_kb with vectors.");
  }

  await db.collection("care_kb").insertMany(
    documents.map((document, index) => ({
      ...document,
      embedding: embeddings[index]
    }))
  );

  return documents.length;
}

async function refreshCustomerStats(db) {
  const [totals, segments, highRisk] = await Promise.all([
    db.collection("customers").aggregate([{ $count: "total" }]).toArray(),
    db
      .collection("customers")
      .aggregate([
        {
          $group: {
            _id: "$segment",
            count: { $sum: 1 },
            avgChurnRisk: { $avg: "$churnRisk" },
            avgLtv: { $avg: "$ltv" }
          }
        },
        { $sort: { count: -1 } }
      ])
      .toArray(),
    db.collection("customers").countDocuments({ churnRisk: { $gte: 0.75 }, status: "active" })
  ]);

  const stats = {
    _id: "summary",
    totalCustomers: totals[0]?.total ?? 0,
    highChurnRiskActive: highRisk,
    segments,
    updatedAt: new Date()
  };

  await db.collection("customer_stats").replaceOne({ _id: "summary" }, stats, { upsert: true });
  return stats;
}

export async function seedDatabase({ reset = false, indexesOnly = false } = {}) {
  const db = await getDb();

  if (indexesOnly) {
    await ensureIndexes(db);
    await ensureCustomersSearchIndex(db, {
      forceRebuild: process.env.CUSTOMERS_SEARCH_FORCE_REBUILD === "1"
    }).catch((error) => {
      console.warn(`[seed] customers search index: ${error.message}`);
    });
    await ensureKbVectorIndex(db).catch((error) => {
      console.warn(`[seed] care_kb vector index: ${error.message}`);
    });
    return { indexesOnly: true };
  }

  const totalCustomers = Math.max(1, env.customerSeedCount);
  const interactionCount = Math.max(0, env.interactionSeedCount);
  const existingCustomers = await db.collection("customers").estimatedDocumentCount();

  if (reset || existingCustomers === 0) {
    if (reset) {
      await dropSeedCollections(db);
    }

    console.log(`[seed] loading ${totalCustomers.toLocaleString()} customers...`);
    const customers = await seedCustomers(db, totalCustomers);

    console.log(`[seed] loading ${interactionCount.toLocaleString()} interactions...`);
    const interactions = await seedInteractions(db, totalCustomers, interactionCount);

    console.log("[seed] loading care knowledge base...");
    const kbCount = await seedCareKb(db);

    console.log("[seed] building indexes...");
    await ensureIndexes(db);

    console.log("[seed] refreshing rollups...");
    const stats = await refreshCustomerStats(db);

    console.log("[seed] ensuring search indexes...");
    const [customersSearchIndex, vectorIndex] = await Promise.all([
      ensureCustomersSearchIndex(db, { forceRebuild: false }),
      ensureKbVectorIndex(db)
    ]);

    await db.collection("demo_settings").updateOne(
      { _id: "ui" },
      {
        $setOnInsert: {
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    return {
      customers,
      interactions,
      careKb: kbCount,
      customersSearchIndex,
      vectorIndex,
      stats
    };
  }

  await ensureIndexes(db);
  await ensureCustomersSearchIndex(db).catch(() => null);
  await ensureKbVectorIndex(db).catch(() => null);
  const stats = await refreshCustomerStats(db);

  return {
    customers: existingCustomers,
    interactions: await db.collection("interactions").estimatedDocumentCount(),
    careKb: await db.collection("care_kb").estimatedDocumentCount(),
    stats
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
