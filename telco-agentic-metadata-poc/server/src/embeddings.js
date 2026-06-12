import env from "./config/env.js";

export const EMBEDDING_DIMENSIONS = Number(process.env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024);

function readVoyageApiKey() {
  return process.env.VOYAGE_API_KEY?.trim() ?? env.voyageApiKey?.trim() ?? "";
}

function readVoyageModel() {
  return process.env.VOYAGE_EMBEDDING_MODEL?.trim() || env.voyageEmbeddingModel || "voyage-4";
}

function joinParts(parts) {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function buildTableSearchableText(table) {
  return joinParts([
    table.schemaName,
    table.tableName,
    table.businessDescription,
    table.tags?.join(" "),
    table.primaryKeys?.join(" "),
    table.sampleQuestions?.join(" "),
    table.columns?.map((column) => `${column.name} ${column.type} ${column.semanticRole ?? ""}`).join(" "),
    table.sampleFields?.join(" "),
    table.sampleData?.map((row) => JSON.stringify(row)).join(" ")
  ]);
}

export function buildEdgeSearchableText(edge) {
  return joinParts([
    edge.sourceTable,
    edge.targetTable,
    edge.sourceColumn,
    edge.targetColumn,
    edge.relationshipDescription,
    edge.cardinality,
    String(edge.confidence)
  ]);
}

export function resolveVoyageEmbeddingsUrl(apiKey = readVoyageApiKey()) {
  if (apiKey.startsWith("al-")) {
    return "https://ai.mongodb.com/v1/embeddings";
  }

  return "https://api.voyageai.com/v1/embeddings";
}

export function voyageConfigured() {
  return Boolean(readVoyageApiKey());
}

export function getEmbeddingMode() {
  return voyageConfigured() ? "voyage" : "lexical";
}

export function getVoyageModel() {
  return readVoyageModel();
}

export function readVoyageStatus() {
  const apiKey = readVoyageApiKey();
  if (!apiKey) {
    return {
      configured: false,
      endpoint: null,
      model: readVoyageModel(),
      dimensions: EMBEDDING_DIMENSIONS
    };
  }

  return {
    configured: true,
    endpoint: resolveVoyageEmbeddingsUrl(apiKey),
    model: readVoyageModel(),
    dimensions: EMBEDDING_DIMENSIONS,
    keyType: apiKey.startsWith("al-") ? "atlas-model-key" : "voyage-platform-key"
  };
}

export async function embedTexts(texts, inputType = "document") {
  const apiKey = readVoyageApiKey();
  if (!apiKey) {
    return null;
  }

  const endpoint = resolveVoyageEmbeddingsUrl(apiKey);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: readVoyageModel(),
      input: texts,
      input_type: inputType,
      output_dimension: EMBEDDING_DIMENSIONS
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const hint =
      apiKey.startsWith("al-") && endpoint.includes("voyageai.com")
        ? " Atlas model keys (al-...) must use https://ai.mongodb.com/v1/embeddings."
        : apiKey.startsWith("pa-") && endpoint.includes("mongodb.com")
          ? " Voyage platform keys (pa-...) must use https://api.voyageai.com/v1/embeddings."
          : "";
    throw new Error(
      `Voyage embeddings failed (${response.status}) via ${endpoint}: ${JSON.stringify(payload)}.${hint}`
    );
  }

  const embeddings = payload.data?.map((item) => item.embedding) ?? null;
  if (!embeddings?.length) {
    throw new Error("Voyage embeddings response did not include vectors.");
  }

  return embeddings;
}

export async function embedSingle(text, inputType = "query") {
  const embeddings = await embedTexts([text], inputType);
  return embeddings?.[0] ?? null;
}
