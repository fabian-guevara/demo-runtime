import { getDb, closeMongoClient } from "./db.js";
import {
  buildEdgeSearchableText,
  buildTableSearchableText,
  embedTexts,
  getEmbeddingMode,
  getVoyageModel,
  voyageConfigured
} from "./embeddings.js";
import { createCatalogSeed } from "./sampleData.js";
import { seedKnowledgeGraph } from "./graphRagStore.js";

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("table_nodes").createIndex({ tableName: 1 }, { unique: true }),
    db.collection("table_nodes").createIndex({ schemaName: 1 }),
    db.collection("table_edges").createIndex({ sourceTable: 1, targetTable: 1 }),
    db.collection("query_examples").createIndex({ question: 1 }),
    db.collection("query_runs").createIndex({ createdAt: -1 }),
    db.collection("metadata_knowledge_graph").createIndex({ type: 1 })
  ]);
}

async function annotateEmbeddings(documents, textBuilder, inputType) {
  const texts = documents.map((document) => textBuilder(document));

  if (!voyageConfigured()) {
    return documents.map((document, index) => ({
      ...document,
      searchableText: texts[index],
      embedding: null
    }));
  }

  const embeddings = await embedTexts(texts, inputType);

  return documents.map((document, index) => ({
    ...document,
    searchableText: texts[index],
    embedding: embeddings?.[index] ?? null
  }));
}

export async function seedDatabase({ indexesOnly = false } = {}) {
  const db = await getDb();
  await ensureIndexes(db);

  if (indexesOnly) {
    console.log("[seed] MongoDB indexes ensured.");
    return {
      indexesOnly: true
    };
  }

  const catalog = createCatalogSeed();
  const tableNodes = await annotateEmbeddings(catalog.tables, buildTableSearchableText, "document");
  const tableEdges = await annotateEmbeddings(catalog.edges, buildEdgeSearchableText, "document");
  const queryExamples = catalog.queryExamples.map((example) => ({
    ...example,
    createdAt: new Date().toISOString()
  }));

  await Promise.all([
    db.collection("table_nodes").deleteMany({}),
    db.collection("table_edges").deleteMany({}),
    db.collection("query_examples").deleteMany({}),
    db.collection("query_runs").deleteMany({}),
    db.collection("metadata_knowledge_graph").deleteMany({})
  ]);

  await db.collection("table_nodes").insertMany(tableNodes);
  await db.collection("table_edges").insertMany(tableEdges);
  await db.collection("query_examples").insertMany(queryExamples);
  const graphSeed = await seedKnowledgeGraph(db, tableNodes, tableEdges);

  console.log("[seed] Seeded agentic metadata catalog", {
    tables: tableNodes.length,
    edges: tableEdges.length,
    queryExamples: queryExamples.length,
    graphEntities: graphSeed.entityCount,
    embeddingMode: getEmbeddingMode(),
    voyageModel: voyageConfigured() ? getVoyageModel() : "not-configured"
  });

  return {
    tableCount: tableNodes.length,
    edgeCount: tableEdges.length,
    queryExampleCount: queryExamples.length,
    graphEntityCount: graphSeed.entityCount,
    embeddingMode: getEmbeddingMode()
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const indexesOnly = process.argv.includes("--indexes-only");

  seedDatabase({ indexesOnly })
    .catch((error) => {
      console.error("[seed] failed", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeMongoClient();
    });
}
