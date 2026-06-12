import { parseModelJson } from "./utils/parseModelJson.js";
import { reloadGroveCredentialsFromLocalEnv } from "./utils/reloadGroveCredentials.js";
import { assertGroveResponseHasText } from "../../../shared/groveResponse.js";

const DEFAULT_GROVE_API_URL =
  "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses";
const DEFAULT_GROVE_MODEL = "gpt-5.5";

function readEnv(key) {
  return process.env[key]?.trim() ?? "";
}

function readGroveApiKey() {
  return readEnv("GROVE_API_KEY") || readEnv("API_KEY");
}

function readGroveModel() {
  return readEnv("GROVE_MODEL") || DEFAULT_GROVE_MODEL;
}

function readGroveApiUrl() {
  return readEnv("GROVE_API_URL") || DEFAULT_GROVE_API_URL;
}

export function groveConfigured() {
  reloadGroveCredentialsFromLocalEnv();
  return Boolean(readGroveApiKey());
}

export function getLlmMode() {
  return groveConfigured() ? "grove" : "unconfigured";
}

export async function callGroveForJson(prompt) {
  const content = await callGrove(
    [
      prompt,
      "Respond with strict JSON only. Do not use markdown fences."
    ].join("\n")
  );
  return parseModelJson(content);
}

async function callGrove(prompt) {
  reloadGroveCredentialsFromLocalEnv();

  if (!groveConfigured()) {
    const error = new Error("Grove is required. Set GROVE_API_KEY in the demo runtime credentials.");
    error.code = "GROVE_REQUIRED";
    throw error;
  }

  const response = await fetch(readGroveApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": readGroveApiKey()
    },
    body: JSON.stringify({
      model: readGroveModel(),
      input: [
        {
          role: "system",
          content:
            "You are a precise data-agent planner. Use only the provided metadata and relationships. Respond with JSON only. Do not use markdown fences."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_output_tokens: 900,
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

  return assertGroveResponseHasText(payload);
}

export async function enhanceArtifactsWithLlm({
  question,
  retrievedTables,
  retrievedEdges,
  queryPlan,
  deterministicArtifacts
}) {
  const prompt = JSON.stringify(
    {
      question,
      retrievedTables: retrievedTables.map((table) => ({
        schemaName: table.schemaName,
        tableName: table.tableName,
        businessDescription: table.businessDescription,
        primaryKeys: table.primaryKeys,
        sampleFields: table.sampleFields
      })),
      retrievedEdges: retrievedEdges.map((edge) => ({
        sourceTable: edge.sourceTable,
        targetTable: edge.targetTable,
        sourceColumn: edge.sourceColumn,
        targetColumn: edge.targetColumn,
        relationshipDescription: edge.relationshipDescription
      })),
      queryPlan: {
        intentKey: queryPlan.intentKey,
        tables: queryPlan.tables,
        joins: queryPlan.joins
      },
      deterministicArtifacts: {
        generatedSqlPreview: deterministicArtifacts.generatedSql?.slice(0, 400),
        explanation: deterministicArtifacts.explanation,
        mongoAlternative: deterministicArtifacts.mongoAlternative
      }
    },
    null,
    2
  );

  try {
    const content = await callGrove(
      [
        "Return strict JSON with exactly these keys:",
        "explanation, mongoAlternativeReason.",
        "Do not include generatedSql.",
        "Keep explanation grounded in the provided metadata only.",
        prompt
      ].join("\n")
    );

    const parsed = parseModelJson(content);

    return {
      generatedSql: deterministicArtifacts.generatedSql,
      explanation: parsed.explanation || deterministicArtifacts.explanation,
      mongoAlternative: {
        ...deterministicArtifacts.mongoAlternative,
        reason: parsed.mongoAlternativeReason || deterministicArtifacts.mongoAlternative.reason
      },
      llmMode: "grove"
    };
  } catch (error) {
    console.warn(`[llm] falling back to deterministic output: ${error.message}`);

    return {
      ...deterministicArtifacts,
      llmMode: error.code === "LLM_JSON_PARSE_FAILED" ? "grove-json-fallback" : "grove-fallback",
      llmError: error.message
    };
  }
}
