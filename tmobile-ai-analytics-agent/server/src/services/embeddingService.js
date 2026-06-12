import crypto from "node:crypto";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import { embedTexts as embedWithVoyage, voyageConfigured } from "./voyageClient.js";

function normalizeNumber(byte) {
  return (byte / 255) * 2 - 1;
}

function deterministicEmbeddingForText(text, dimensions = env.voyageEmbeddingDimensions) {
  const vector = [];
  let seed = text;

  while (vector.length < dimensions) {
    const digest = crypto.createHash("sha256").update(seed).digest();

    for (const byte of digest) {
      vector.push(Number(normalizeNumber(byte).toFixed(6)));
      if (vector.length === dimensions) {
        break;
      }
    }

    seed = `${seed}:${vector.length}`;
  }

  return vector;
}

export async function embedTexts({ texts, inputType = "document", model = env.voyageEmbeddingModel }) {
  if (voyageConfigured()) {
    try {
      const result = await embedWithVoyage({
        texts,
        inputType,
        model,
        outputDimension: env.voyageEmbeddingDimensions
      });

      return {
        embeddings: result.embeddings,
        model: result.model,
        mock: false
      };
    } catch (error) {
      logger.warn("VoyageAI embeddings unavailable. Falling back to deterministic mock embeddings.", {
        code: error.code ?? "UNKNOWN",
        message: error.message
      });
    }
  }

  logger.warn("Using deterministic mock embeddings for local setup.");

  return {
    embeddings: texts.map((text) => deterministicEmbeddingForText(text)),
    model: `mock-${model}`,
    mock: true
  };
}

export async function embedText({ text, inputType = "document", model = env.voyageEmbeddingModel }) {
  const result = await embedTexts({
    texts: [text],
    inputType,
    model
  });

  return {
    embedding: result.embeddings[0],
    model: result.model,
    mock: result.mock
  };
}

export function cosineSimilarity(left = [], right = []) {
  if (!left.length || !right.length || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMag += left[index] * left[index];
    rightMag += right[index] * right[index];
  }

  if (leftMag === 0 || rightMag === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
}
