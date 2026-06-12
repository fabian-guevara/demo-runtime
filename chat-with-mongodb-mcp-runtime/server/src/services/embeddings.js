import env from "../config/env.js";

function readVoyageApiKey() {
  return process.env.VOYAGE_API_KEY?.trim() ?? "";
}

function readVoyageModel() {
  return process.env.VOYAGE_EMBEDDING_MODEL?.trim() || env.voyageEmbeddingModel;
}

function readVoyageDimensions() {
  const raw = process.env.VOYAGE_EMBEDDING_DIMENSIONS ?? String(env.voyageEmbeddingDimensions);
  return Number(raw);
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

export function readVoyageStatus() {
  const apiKey = readVoyageApiKey();
  if (!apiKey) {
    return { configured: false, endpoint: null, model: readVoyageModel(), dimensions: readVoyageDimensions() };
  }

  return {
    configured: true,
    endpoint: resolveVoyageEmbeddingsUrl(apiKey),
    model: readVoyageModel(),
    dimensions: readVoyageDimensions(),
    keyType: apiKey.startsWith("al-") ? "atlas-model-key" : "voyage-platform-key"
  };
}

export async function embedTexts(texts, inputType = "document") {
  const apiKey = readVoyageApiKey();
  if (!apiKey) {
    const error = new Error("VOYAGE_API_KEY is required for vector search and manual embeddings.");
    error.code = "VOYAGE_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(resolveVoyageEmbeddingsUrl(apiKey), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input: texts,
      model: readVoyageModel(),
      input_type: inputType,
      output_dimension: readVoyageDimensions()
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const endpoint = resolveVoyageEmbeddingsUrl(apiKey);
    const hint =
      apiKey.startsWith("al-") && endpoint.includes("voyageai.com")
        ? " Atlas model keys (al-...) must use https://ai.mongodb.com/v1/embeddings."
        : apiKey.startsWith("pa-") && endpoint.includes("mongodb.com")
          ? " Voyage platform keys (pa-...) must use https://api.voyageai.com/v1/embeddings."
          : "";
    const error = new Error(
      `Voyage embeddings failed (${response.status}) via ${endpoint}: ${JSON.stringify(payload)}.${hint}`
    );
    error.code = "VOYAGE_REQUEST_FAILED";
    throw error;
  }

  const embeddings = payload.data?.map((item) => item.embedding) ?? null;
  if (!embeddings?.length) {
    const error = new Error("Voyage embeddings response did not include vectors.");
    error.code = "VOYAGE_EMPTY_RESPONSE";
    throw error;
  }

  return embeddings;
}

export async function embedSingle(text, inputType = "query") {
  const embeddings = await embedTexts([text], inputType);
  return embeddings[0];
}
