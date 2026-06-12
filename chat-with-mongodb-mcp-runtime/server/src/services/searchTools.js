import env from "../config/env.js";
import { embedSingle, voyageConfigured } from "./embeddings.js";
import { trackedRuntimeAction } from "../../../.demo/runtime-tracker.js";

function buildSearchableText(chunk) {
  return [chunk.title, chunk.alertType, ...(chunk.probableCauses ?? []), ...(chunk.remediationSteps ?? [])].join(" ");
}

export async function vectorSearchManuals(db, userInput, limit = 5) {
  if (!voyageConfigured()) {
    const error = new Error("VOYAGE_API_KEY is required for vector_search_tool.");
    error.code = "VOYAGE_NOT_CONFIGURED";
    throw error;
  }

  const queryEmbedding = await embedSingle(userInput, "query");

  const pipeline = [
    {
      $vectorSearch: {
        index: env.manualsVectorIndex,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 10, 20),
        limit
      }
    },
    {
      $project: {
        _id: 0,
        title: 1,
        alertType: 1,
        probableCauses: 1,
        remediationSteps: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  return trackedRuntimeAction({
    name: "Vector search manuals",
    toolName: "vectorSearchManuals",
    dbName: db.databaseName,
    collectionName: "manuals",
    operation: "aggregate",
    query: pipeline,
    run: async () => db.collection("manuals").aggregate(pipeline).toArray()
  });
}

export async function lexicalSearchManuals(db, userInput, limit = 5) {
  const documents = await db.collection("manuals").find({}).toArray();
  const tokens = userInput.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);

  return documents
    .map((document) => {
      const haystack = buildSearchableText(document).toLowerCase();
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { ...document, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ _id, embedding, ...rest }) => rest);
}

export async function textSearchManuals(db, userInput, limit = 5) {
  try {
    const pipeline = [
      {
        $search: {
          index: "manuals_text_index",
          text: {
            query: userInput,
            path: { wildcard: "*" }
          }
        }
      },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          title: 1,
          alertType: 1,
          probableCauses: 1,
          remediationSteps: 1
        }
      }
    ];

    return await db.collection("manuals").aggregate(pipeline).toArray();
  } catch (error) {
    console.warn(`[search] atlas text fallback: ${error.message}`);
    return lexicalSearchManuals(db, userInput, limit);
  }
}

export async function fusionSearchManuals(db, userInput, limit = 5) {
  const [vectorResults, textResults] = await Promise.all([
    vectorSearchManuals(db, userInput, limit),
    textSearchManuals(db, userInput, limit)
  ]);

  const merged = new Map();
  for (const result of [...vectorResults, ...textResults]) {
    merged.set(result.title, result);
  }

  return [...merged.values()].slice(0, limit);
}

export function getUtcTime() {
  return new Date().toISOString();
}

export const customTools = {
  get_utc_time: {
    description: "Returns the current UTC date and time in ISO format.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => getUtcTime()
  },
  vector_search_tool: {
    description:
      "Search the manuals collection using vector search for remediation steps related to an alert condition.",
    parameters: {
      type: "object",
      properties: {
        user_input: { type: "string" }
      },
      required: ["user_input"],
      additionalProperties: false
    },
    handler: async ({ db }, { user_input: userInput }) => vectorSearchManuals(db, userInput)
  },
  text_search_tool: {
    description: "Search the manuals collection using Atlas Search text queries.",
    parameters: {
      type: "object",
      properties: {
        user_input: { type: "string" }
      },
      required: ["user_input"],
      additionalProperties: false
    },
    handler: async ({ db }, { user_input: userInput }) => textSearchManuals(db, userInput)
  },
  fusion_search_tool: {
    description: "Search the manuals collection using vector + text fusion.",
    parameters: {
      type: "object",
      properties: {
        user_input: { type: "string" }
      },
      required: ["user_input"],
      additionalProperties: false
    },
    handler: async ({ db }, { user_input: userInput }) => fusionSearchManuals(db, userInput)
  }
};
