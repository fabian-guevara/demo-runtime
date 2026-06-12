import env from "./config/env.js";
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

function scoreTable(question, table) {
  const questionTokens = tokenize(question);
  const textTokens = tokenize(table.searchableText);
  return (
    overlapScore(questionTokens, textTokens) +
    (normalize(question).includes(table.tableName.replaceAll("_", " ")) ? 8 : 0) +
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
    (normalize(question).includes(edge.sourceTable.replaceAll("_", " ")) ? 4 : 0) +
    (normalize(question).includes(edge.targetTable.replaceAll("_", " ")) ? 4 : 0)
  );
}

async function lexicalSearch({ db, collectionName, question, documents, scoreDocument, limit, kind }) {
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
      retrievalMode: "lexical_degraded",
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

  return lexicalResults.map((item) => ({
    ...item,
    score: Number((item.score ?? 0).toFixed(4))
  }));
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
  const warnings = [];

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
          mode: "vector",
          warnings
        };
      }

      warnings.push(`Vector index ${indexName} returned no matches for ${collectionName}.`);
    } catch (error) {
      warnings.push(`Vector search unavailable for ${collectionName}: ${error.message}`);
    }
  } else {
    warnings.push(`Embeddings unavailable; using lexical degraded retrieval for ${collectionName}.`);
  }

  if (env.requireVectorSearch) {
    const error = new Error(
      `REQUIRE_VECTOR_SEARCH=true but vector search is unavailable for ${collectionName}. ${warnings.join(" ")}`
    );
    error.code = "VECTOR_SEARCH_UNAVAILABLE";
    throw error;
  }

  return {
    results: await lexicalSearch({
      db,
      collectionName,
      question,
      documents,
      scoreDocument,
      limit,
      kind
    }),
    mode: "lexical_degraded",
    warnings
  };
}

export async function retrieveRelevantMetadata({ db, question, tableCatalog, edgeCatalog }) {
  let questionEmbedding = null;
  let embeddingMode = getEmbeddingMode();
  const warnings = [];

  try {
    questionEmbedding = await embedSingle(question, "query");
    if (!questionEmbedding) {
      embeddingMode = "unavailable";
      warnings.push("Embedding generation unavailable; retrieval will use lexical degraded mode.");
    }
  } catch (error) {
    embeddingMode = "unavailable";
    warnings.push(error.message);
    if (env.requireEmbeddings) {
      throw error;
    }
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
        searchableText: 1,
        classification: 1,
        containsPii: 1,
        owner: 1
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

  const retrievalMode =
    tableSearch.mode === "vector" && edgeSearch.mode === "vector"
      ? "vector"
      : tableSearch.mode === "lexical_degraded" || edgeSearch.mode === "lexical_degraded"
        ? "lexical_degraded"
        : "unavailable";

  return {
    retrievedTables: tableSearch.results,
    retrievedEdges: edgeSearch.results,
    retrievalMode,
    embeddingMode,
    warnings: [...warnings, ...tableSearch.warnings, ...edgeSearch.warnings]
  };
}
