import env from "../config/env.js";
import { embedSingle, voyageConfigured } from "./embeddings.js";
import { lookupCustomer, getSegmentInsights } from "./customerInsights.js";
import { trackedRuntimeAction } from "../../../.demo/runtime-tracker.js";

function buildSearchableText(chunk) {
  return [chunk.title, chunk.topic, chunk.summary, ...(chunk.guidance ?? [])].join(" ");
}

export async function vectorSearchCareKb(db, userInput, limit = 5) {
  if (!voyageConfigured()) {
    const error = new Error("VOYAGE_API_KEY is required for vector_search_tool.");
    error.code = "VOYAGE_NOT_CONFIGURED";
    throw error;
  }

  const queryEmbedding = await embedSingle(userInput, "query");

  const pipeline = [
    {
      $vectorSearch: {
        index: env.kbVectorIndex,
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
        topic: 1,
        summary: 1,
        guidance: 1,
        score: { $meta: "vectorSearchScore" }
      }
    }
  ];

  return trackedRuntimeAction({
    name: "Vector search care KB",
    toolName: "vectorSearchCareKb",
    dbName: db.databaseName,
    collectionName: "care_kb",
    operation: "aggregate",
    query: pipeline,
    run: async () => db.collection("care_kb").aggregate(pipeline).toArray()
  });
}

export async function lexicalSearchCareKb(db, userInput, limit = 5) {
  const documents = await db.collection("care_kb").find({}).toArray();
  const tokens = userInput.toLowerCase().split(/[^a-z0-9]+/g).filter(Boolean);

  return documents
    .map((document) => {
      const haystack = buildSearchableText(document).toLowerCase();
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { ...document, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ _id, embedding, searchableText, ...rest }) => rest);
}

export async function textSearchCareKb(db, userInput, limit = 5) {
  try {
    const pipeline = [
      {
        $search: {
          index: "care_kb_text_index",
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
          topic: 1,
          summary: 1,
          guidance: 1
        }
      }
    ];

    return await db.collection("care_kb").aggregate(pipeline).toArray();
  } catch (error) {
    console.warn(`[search] atlas text fallback: ${error.message}`);
    return lexicalSearchCareKb(db, userInput, limit);
  }
}

export async function fusionSearchCareKb(db, userInput, limit = 5) {
  const [vectorResults, textResults] = await Promise.all([
    vectorSearchCareKb(db, userInput, limit),
    textSearchCareKb(db, userInput, limit)
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
  lookup_customer_tool: {
    description:
      "Find a customer by customerId, phone/msisdn, email, or partial name match in the 1M+ customers collection.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"],
      additionalProperties: false
    },
    handler: async ({ db }, { query }) => lookupCustomer(db, query)
  },
  segment_insights_tool: {
    description:
      "Summarize customer counts, average churn risk, average LTV, and top at-risk customers for a segment and/or market.",
    parameters: {
      type: "object",
      properties: {
        segment: { type: "string" },
        market: { type: "string" }
      },
      additionalProperties: false
    },
    handler: async ({ db }, { segment = "", market = "" }) => getSegmentInsights(db, { segment, market })
  },
  vector_search_tool: {
    description: "Search the care_kb collection using vector search for care and retention guidance.",
    parameters: {
      type: "object",
      properties: {
        user_input: { type: "string" }
      },
      required: ["user_input"],
      additionalProperties: false
    },
    handler: async ({ db }, { user_input: userInput }) => vectorSearchCareKb(db, userInput)
  },
  text_search_tool: {
    description: "Search the care_kb collection using Atlas Search text queries.",
    parameters: {
      type: "object",
      properties: {
        user_input: { type: "string" }
      },
      required: ["user_input"],
      additionalProperties: false
    },
    handler: async ({ db }, { user_input: userInput }) => textSearchCareKb(db, userInput)
  },
  fusion_search_tool: {
    description: "Search the care_kb collection using vector + text fusion.",
    parameters: {
      type: "object",
      properties: {
        user_input: { type: "string" }
      },
      required: ["user_input"],
      additionalProperties: false
    },
    handler: async ({ db }, { user_input: userInput }) => fusionSearchCareKb(db, userInput)
  }
};
