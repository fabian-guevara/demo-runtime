import env from "../config/env.js";

function resolveVoyageEmbeddingsUrl(apiKey = process.env.VOYAGE_API_KEY?.trim() ?? "") {
  if (apiKey.startsWith("al-")) {
    return "https://ai.mongodb.com/v1/embeddings";
  }

  return "https://api.voyageai.com/v1/embeddings";
}

function assertVoyageConfig() {
  if (!process.env.VOYAGE_API_KEY) {
    const error = new Error("Missing VoyageAI configuration: VOYAGE_API_KEY");
    error.code = "VOYAGE_CONFIG_MISSING";
    throw error;
  }
}

export async function testEmbedding(text) {
  assertVoyageConfig();

  const apiKey = process.env.VOYAGE_API_KEY.trim();
  const endpoint = resolveVoyageEmbeddingsUrl(apiKey);
  const model = process.env.VOYAGE_EMBEDDING_MODEL ?? env.voyageEmbeddingModel;
  const outputDimension = Number(process.env.VOYAGE_EMBEDDING_DIMENSIONS ?? 1024);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      input: text,
      model,
      input_type: "document",
      output_dimension: outputDimension
    })
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(
      response.status === 401 || response.status === 403
        ? `Voyage rejected the API key via ${endpoint}. Atlas keys (al-...) must use ai.mongodb.com; platform keys (pa-...) must use api.voyageai.com. ${details}`
        : `Voyage embedding request failed with status ${response.status} via ${endpoint}. ${details}`
    );
    error.code = "VOYAGE_REQUEST_FAILED";
    throw error;
  }

  const payload = await response.json();
  const embedding = payload.data?.[0]?.embedding ?? [];

  return {
    model: payload.model ?? model,
    endpoint,
    dimensions: embedding.length,
    embeddingPreview: embedding.slice(0, 5)
  };
}
