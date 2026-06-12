import env from "../config/env.js";

export function voyageConfigured() {
  return Boolean(env.voyageApiKey);
}

export async function embedTexts({ texts, inputType = "document", model = env.voyageEmbeddingModel, outputDimension = env.voyageEmbeddingDimensions }) {
  if (!voyageConfigured()) {
    const error = new Error("VOYAGE_API_KEY is not configured.");
    error.code = "VOYAGE_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.voyageApiKey}`
    },
    body: JSON.stringify({
      input: texts,
      model,
      input_type: inputType,
      output_dimension: outputDimension
    })
  });

  if (!response.ok) {
    const details = await response.text();
    const error = new Error(`VoyageAI request failed with status ${response.status}. ${details}`);
    error.code = "VOYAGE_REQUEST_FAILED";
    throw error;
  }

  const payload = await response.json();
  return {
    embeddings: payload.data?.map((item) => item.embedding) ?? [],
    model: payload.model ?? model
  };
}
