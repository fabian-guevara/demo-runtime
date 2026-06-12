import env from "../config/env.js";
import logger from "../utils/logger.js";
import {
  assertGroveResponseHasText,
  describeGroveOutput,
  extractGroveResponseText
} from "../../../../shared/groveResponse.js";

export const DEFAULT_GROVE_API_URL =
  "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses";
export const DEFAULT_GROVE_MODEL = "gpt-5.5";

export function readGroveApiKey() {
  return process.env.GROVE_API_KEY?.trim() || process.env.API_KEY?.trim() || "";
}

export function readGroveModel() {
  return process.env.GROVE_MODEL?.trim() || env.groveModel || DEFAULT_GROVE_MODEL;
}

export function readGroveApiUrl() {
  return process.env.GROVE_API_URL?.trim() || env.groveApiUrl || DEFAULT_GROVE_API_URL;
}

export function groveConfigured() {
  return Boolean(readGroveApiKey());
}

export { extractGroveResponseText as extractResponseText, describeGroveOutput };

function assertGroveConfig() {
  if (!groveConfigured()) {
    const error = new Error("Missing Grove configuration: GROVE_API_KEY");
    error.code = "GROVE_CONFIG_MISSING";
    error.credentialKeys = ["GROVE_API_KEY"];
    throw error;
  }
}

function buildInput({ systemPrompt, userPrompt, prompt }) {
  if (prompt) {
    return prompt;
  }

  if (systemPrompt && userPrompt) {
    return [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
  }

  return userPrompt ?? systemPrompt ?? "";
}

function normalizeGroveError(error, responseBody, status) {
  if (error?.code === "GROVE_CONFIG_MISSING" || error?.code === "GROVE_AUTH_FAILED") {
    return error;
  }

  const detail =
    typeof responseBody?.error === "string"
      ? responseBody.error
      : responseBody?.error?.message ?? responseBody?.message;

  const normalized = new Error(detail || error?.message || "Grove request failed.");

  if (status === 401 || status === 403) {
    normalized.message = "Grove API rejected the api-key. Check GROVE_API_KEY in Credentials.";
    normalized.code = "GROVE_AUTH_FAILED";
    normalized.credentialKeys = ["GROVE_API_KEY"];
    return normalized;
  }

  normalized.cause = error;
  return normalized;
}

export async function callGrove({
  systemPrompt,
  userPrompt,
  prompt,
  model,
  maxOutputTokens = 500
}) {
  assertGroveConfig();

  const apiUrl = readGroveApiUrl();
  const resolvedModel = model ?? readGroveModel();
  const input = buildInput({ systemPrompt, userPrompt, prompt });
  const body = {
    model: resolvedModel,
    input,
    text: {
      format: {
        type: "text"
      }
    }
  };

  if (maxOutputTokens) {
    body.max_output_tokens = maxOutputTokens;
  }

  let response;
  let responseBody = {};

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": readGroveApiKey()
      },
      body: JSON.stringify(body)
    });

    responseBody = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw normalizeGroveError(new Error(`HTTP ${response.status}`), responseBody, response.status);
    }
  } catch (error) {
    throw normalizeGroveError(error, responseBody, response?.status);
  }

  const text = assertGroveResponseHasText(responseBody);

  return {
    text,
    model: resolvedModel,
    raw: responseBody
  };
}

export async function testGrovePrompt(prompt) {
  logger.info("Grove preflight request starting", {
    model: readGroveModel(),
    apiUrl: readGroveApiUrl(),
    promptPreview: prompt.slice(0, 80),
    hasApiKey: Boolean(readGroveApiKey())
  });

  const result = await callGrove({ prompt, maxOutputTokens: 256 });

  logger.info("Grove preflight request succeeded", {
    model: result.model,
    responseId: result.raw?.id ?? null,
    responsePreview: result.text.slice(0, 120)
  });

  return {
    model: result.model,
    apiUrl: readGroveApiUrl(),
    text: result.text,
    usage: result.raw?.usage ?? null
  };
}

export async function generateNarrative({ systemPrompt, userPrompt }) {
  const result = await callGrove({ systemPrompt, userPrompt, maxOutputTokens: 500 });

  return {
    text: result.text,
    modelId: result.model
  };
}
