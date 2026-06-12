import env from "../config/env.js";
import {
  assertGroveResponseHasText,
  extractGroveResponseText
} from "../../../../shared/groveResponse.js";
import { reloadGroveCredentialsFromLocalEnv } from "../utils/reloadGroveCredentials.js";

export const DEFAULT_GROVE_API_URL =
  "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses";
export const DEFAULT_GROVE_MODEL = "gpt-5.5";

function readGroveApiKey() {
  return process.env.GROVE_API_KEY?.trim() || process.env.API_KEY?.trim() || "";
}

function readGroveModel() {
  return process.env.GROVE_MODEL?.trim() || env.groveModel || DEFAULT_GROVE_MODEL;
}

function readGroveApiUrl() {
  return process.env.GROVE_API_URL?.trim() || env.groveApiUrl || DEFAULT_GROVE_API_URL;
}

export function groveConfigured() {
  reloadGroveCredentialsFromLocalEnv(env.rootDir);
  return Boolean(readGroveApiKey());
}

export async function generateNarrative({ systemPrompt, userPrompt }) {
  reloadGroveCredentialsFromLocalEnv(env.rootDir);

  if (!readGroveApiKey()) {
    const error = new Error("Grove is not configured. Set GROVE_API_KEY.");
    error.code = "GROVE_NOT_CONFIGURED";
    throw error;
  }

  const input =
    systemPrompt && userPrompt
      ? [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      : userPrompt ?? systemPrompt ?? "";

  const response = await fetch(readGroveApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": readGroveApiKey()
    },
    body: JSON.stringify({
      model: readGroveModel(),
      input,
      max_output_tokens: 500,
      text: {
        format: {
          type: "text"
        }
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message ?? payload?.message ?? `HTTP ${response.status}`;
    const error = new Error(`Grove request failed: ${detail}`);
    error.code = response.status === 401 || response.status === 403 ? "GROVE_AUTH_FAILED" : "GROVE_REQUEST_FAILED";
    throw error;
  }

  return {
    text: assertGroveResponseHasText(payload),
    modelId: readGroveModel()
  };
}

export { extractGroveResponseText };
