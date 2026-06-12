import { trackedRuntimeAction } from "../../.demo/runtime-tracker.js";
import { embedSingle, getEmbeddingMode } from "./embeddings.js";

const TABLE_INDEX = "table_nodes_vector_index";
const EDGE_INDEX = "table_edges_vector_index";

function normalize(text) {
  return String(text).toLowerCase();
}

function tokenize(text) {
  return normalize(text)
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length > 1);
}

function overlapScore(questionTokens, candidateTokens) {
  const candidateSet = new Set(candidateTokens);
  return questionTokens.reduce((score, token) => score + (candidateSet.has(token) ? 1 : 0), 0);
}

function boostForKnownPatterns(question, candidate, kind) {
  const normalizedQuestion = normalize(question);
  const name = kind === "table" ? candidate.tableName : `${candidate.sourceTable} ${candidate.targetTable}`;
  let boost = 0;

  if (normalizedQuestion.includes("high-value") && /value|segment/.test(name)) {
    boost += 10;
  }

  if (normalizedQuestion.includes("billing") && /billing/.test(name)) {
    boost += 10;
  }

  if (normalizedQuestion.includes("migration") && /migration|plan/.test(name)) {
    boost += 9;
  }

  if (normalizedQuestion.includes("churn") && /churn|risk|account/.test(name)) {
    boost += 8;
  }

  if (normalizedQuestion.includes("support") && /support|case/.test(name)) {
    boost += 7;
  }

  if (normalizedQuestion.includes("join path") && kind === "edge") {
    boost += 6;
  }

  return boost;
}

function scoreTable(question, table) {
  const questionTokens = tokenize(question);
  const textTokens = tokenize(table.searchableText);
  return (
    overlapScore(questionTokens, textTokens) +
    boostForKnownPatterns(question, table, "table") +
    (normalize(question).includes(table.tableName.replaceAll("_", " ")) ? 12 : 0) +
    (table.sampleQuestions ?? []).reduce(
      (score, sampleQuestion) => score + overlapScore(questionTokens, tokenize(sampleQuestion)) * 0.5,
      0
    )
  );
}

function scoreEdge(question, edge) {
  const questionTokens = tokenize(question);
  const textTokens = tokenize(edge.searchableText);
  return (
    overlapScore(questionTokens, textTokens) +
    boostForKnownPatterns(question, edge, "edge") +
    (normalize(question).includes(edge.sourceTable.replaceAll("_", " ")) ? 4 : 0) +
    (normalize(question).includes(edge.targetTable.replaceAll("_", " ")) ? 4 : 0)
  );
}

async function vectorSearchOrFallback({
  db,
  collectionName,
  indexName,
  question,
  questionEmbedding,
  documents,
  scoreDocument,
  limit,
  projection,
  kind
}) {
  if (questionEmbedding) {
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: indexName,
            path: "embedding",
            queryVector: questionEmbedding,
            numCandidates: Math.max(limit * 8, 25),
            limit
          }
        },
        {
          $project: {
            ...projection,
            score: { $meta: "vectorSearchScore" }
          }
        }
      ];

      const vectorResult = await trackedRuntimeAction({
        name: `Vector search ${collectionName}`,
        toolName: "vectorSearch",
        dbName: db.databaseName,
        collectionName,
        operation: "aggregate",
        query: pipeline,
        metadata: {
          retrievalMode: "vector"
        },
        run: async () => db.collection(collectionName).aggregate(pipeline).toArray()
      });

      if (vectorResult.length > 0) {
        return {
          results: vectorResult.map((item) => ({
            ...item,
            score: Number((item.score ?? 0).toFixed(4))
          })),
          mode: "vector"
        };
      }
    } catch (error) {
      console.warn(`[retrieval] vector search fallback for ${collectionName}: ${error.message}`);
    }
  }

  const lexicalResults = await trackedRuntimeAction({
    name: `Lexical search ${collectionName}`,
    toolName: "lexicalSearch",
    dbName: db.databaseName,
    collectionName,
    operation: "find",
    query: {
      searchableText: {
        $regex: tokenize(question).slice(0, 6).join("|"),
        $options: "i"
      }
    },
    metadata: {
      retrievalMode: "lexical",
      kind
    },
    run: async () =>
      documents
        .map((document) => ({
          ...document,
          score: scoreDocument(question, document)
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
  });

  return {
    results: lexicalResults.map((item) => ({
      ...item,
      score: Number((item.score ?? 0).toFixed(4))
    })),
    mode: "lexical"
  };
}

export async function retrieveRelevantMetadata({ db, question, tableCatalog, edgeCatalog }) {
  let questionEmbedding = null;

  try {
    questionEmbedding = await embedSingle(question, "query");
  } catch (error) {
    console.warn(`[retrieval] embedding fallback enabled: ${error.message}`);
  }

  const [tableSearch, edgeSearch] = await Promise.all([
    vectorSearchOrFallback({
      db,
      collectionName: "table_nodes",
      indexName: TABLE_INDEX,
      question,
      questionEmbedding,
      documents: tableCatalog,
      scoreDocument: scoreTable,
      limit: 6,
      kind: "table",
      projection: {
        _id: 1,
        nodeType: 1,
        tableName: 1,
        schemaName: 1,
        businessDescription: 1,
        columns: 1,
        primaryKeys: 1,
        rowCount: 1,
        freshness: 1,
        sourceSystem: 1,
        tags: 1,
        sampleQuestions: 1,
        sampleFields: 1,
        sampleData: 1,
        scannedTimestamp: 1,
        searchableText: 1
      }
    }),
    vectorSearchOrFallback({
      db,
      collectionName: "table_edges",
      indexName: EDGE_INDEX,
      question,
      questionEmbedding,
      documents: edgeCatalog,
      scoreDocument: scoreEdge,
      limit: 8,
      kind: "edge",
      projection: {
        _id: 1,
        edgeType: 1,
        sourceTable: 1,
        targetTable: 1,
        sourceColumn: 1,
        targetColumn: 1,
        confidence: 1,
        relationshipDescription: 1,
        cardinality: 1,
        freshness: 1,
        searchableText: 1
      }
    })
  ]);

  return {
    retrievedTables: tableSearch.results,
    retrievedEdges: edgeSearch.results,
    retrievalMode:
      tableSearch.mode === "vector" || edgeSearch.mode === "vector"
        ? "vector"
        : getEmbeddingMode(),
    embeddingMode: questionEmbedding ? "voyage-query-embedding" : "lexical-only"
  };
}
