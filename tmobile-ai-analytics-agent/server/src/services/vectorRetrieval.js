import { getDb } from "../config/db.js";
import { vectorSearchStage } from "../mongo/queries.js";
import { embedText } from "./embeddingService.js";
import { trackedMongoAction } from "./telemetryService.js";

const VECTOR_SEARCH_UNAVAILABLE =
  /localhost:28000|mongot|auto[- ]?embed|vector search index|index not found|SearchNotEnabled|PlanExecutor error/i;

export function isVectorSearchUnavailableError(error) {
  return VECTOR_SEARCH_UNAVAILABLE.test(error?.message ?? "");
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length > 1);
}

function scoreTextMatch(query, text) {
  const queryTokens = tokenize(query);
  const textTokens = new Set(tokenize(text));

  return queryTokens.reduce((score, token) => score + (textTokens.has(token) ? 1 : 0), 0);
}

export async function lexicalTextSearch({
  collectionName,
  query,
  textField,
  filter = {},
  limit,
  projection = {},
  toolName,
  name
}) {
  const db = await getDb();
  const { result, telemetryId } = await trackedMongoAction({
    name: name ?? `Lexical search on ${collectionName}`,
    toolName: toolName ?? "lexicalSearch",
    dbName: db.databaseName,
    collectionName,
    operation: "find",
    query: {
      filter,
      options: {
        limit: Math.max(limit * 12, 40)
      }
    },
    embeddingModel: "lexical-fallback",
    metadata: {
      retrievalMode: "lexical"
    },
    run: async () => {
      const docs = await db
        .collection(collectionName)
        .find(filter, { limit: Math.max(limit * 12, 40) })
        .toArray();

      return docs
        .map((doc) => ({
          doc,
          score: Number(
            (scoreTextMatch(query, doc[textField]) / queryTokensLength(query)).toFixed(4)
          )
        }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)
        .map(({ doc, score }) => ({
          ...pickProjectedFields(doc, projection),
          score
        }));
    }
  });

  return {
    docs: result,
    telemetryId,
    retrievalMode: "lexical"
  };
}

function pickProjectedFields(doc, projection) {
  if (!projection || Object.keys(projection).length === 0) {
    return doc;
  }

  const picked = {};

  for (const [key, value] of Object.entries(projection)) {
    if (value === 1) {
      picked[key] = doc[key];
    }

    if (value?.$literal !== undefined) {
      picked[key] = value.$literal;
    }
  }

  return picked;
}

function queryTokensLength(query) {
  return Math.max(tokenize(query).length, 1);
}

export async function vectorSearchWithFallback({
  collectionName,
  indexName,
  query,
  textField,
  filter = {},
  limit,
  projection = {},
  toolName,
  name
}) {
  const db = await getDb();

  try {
    const { embedding, model } = await embedText({
      text: query,
      inputType: "query"
    });
    const pipeline = [
      vectorSearchStage({
        indexName,
        queryVector: embedding,
        limit,
        filter: Object.keys(filter).length ? filter : null
      }),
      {
        $project: {
          _id: 0,
          score: { $meta: "vectorSearchScore" },
          ...projection
        }
      }
    ];

    const { result, telemetryId } = await trackedMongoAction({
      name: name ?? `Vector search on ${collectionName}`,
      toolName: toolName ?? "vectorSearch",
      dbName: db.databaseName,
      collectionName,
      operation: "aggregate",
      query: pipeline,
      embeddingModel: model,
      metadata: {
        retrievalMode: "vector"
      },
      run: async () => db.collection(collectionName).aggregate(pipeline).toArray()
    });

    if (result.length > 0) {
      return {
        docs: result.map((item) => ({
          ...item,
          score: Number((item.score ?? 0).toFixed(4))
        })),
        telemetryId,
        retrievalMode: "vector",
        embeddingModel: model
      };
    }
  } catch (error) {
    if (!isVectorSearchUnavailableError(error)) {
      throw error;
    }
  }

  const lexical = await lexicalTextSearch({
    collectionName,
    query,
    textField,
    filter,
    limit,
    projection,
    toolName,
    name: `${name ?? collectionName} lexical fallback`
  });

  return lexical;
}
