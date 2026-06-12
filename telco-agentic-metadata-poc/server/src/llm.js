import env from "./config/env.js";
import { parseModelJson } from "./utils/parseModelJson.js";
import { reloadGroveCredentialsFromLocalEnv } from "./utils/reloadGroveCredentials.js";
import { assertGroveResponseHasText } from "../../../shared/groveResponse.js";
import { validateQueryPlan } from "./planValidator.js";

const DEFAULT_GROVE_API_URL =
  "https://grove-gateway-prod.azure-api.net/grove-foundry-prod/openai/v1/responses";
const DEFAULT_GROVE_MODEL = "gpt-5.5";

const PLAN_JSON_SCHEMA = {
  intent: "string",
  tables: [
    {
      tableName: "string",
      reason: "string",
      confidence: "number 0-1",
      evidence: ["string"]
    }
  ],
  columns: [
    {
      tableName: "string",
      columnName: "string",
      reason: "string",
      confidence: "number 0-1"
    }
  ],
  joins: [
    {
      sourceTable: "string",
      targetTable: "string",
      sourceColumn: "string",
      targetColumn: "string",
      confidence: "number 0-1",
      evidence: ["string"]
    }
  ],
  filters: [{ expression: "string", confidence: "number 0-1", assumption: "boolean" }],
  metrics: [
    {
      name: "string",
      expression: "string",
      sourceColumns: ["table.column"],
      confidence: "number 0-1"
    }
  ],
  assumptions: ["string"],
  confidence: "number 0-1",
  limitations: ["string"]
};

function readGroveApiKey() {
  reloadGroveCredentialsFromLocalEnv();
  return process.env.GROVE_API_KEY?.trim() || process.env.API_KEY?.trim() || "";
}

function readGroveModel() {
  return process.env.GROVE_MODEL?.trim() || env.groveModel || DEFAULT_GROVE_MODEL;
}

function readGroveApiUrl() {
  return process.env.GROVE_BASE_URL?.trim() || process.env.GROVE_API_URL?.trim() || env.groveApiUrl || DEFAULT_GROVE_API_URL;
}

export function groveConfigured() {
  return Boolean(readGroveApiKey());
}

export function getLlmMode({ degraded = false } = {}) {
  if (!env.requireLlm) {
    return "unavailable";
  }

  if (!groveConfigured()) {
    return "unavailable";
  }

  return degraded ? "grove_degraded" : "grove";
}

function normalizePlan(rawPlan) {
  return {
    intent: String(rawPlan.intent ?? "Metadata-grounded query plan"),
    tables: (rawPlan.tables ?? []).map((table) => ({
      tableName: table.tableName,
      schemaName: table.schemaName,
      reason: table.reason ?? "",
      confidence: Number(table.confidence ?? 0),
      evidence: table.evidence ?? []
    })),
    columns: (rawPlan.columns ?? []).map((column) => ({
      tableName: column.tableName,
      columnName: column.columnName,
      reason: column.reason ?? "",
      confidence: Number(column.confidence ?? 0),
      evidence: column.evidence ?? [column.reason].filter(Boolean)
    })),
    joins: (rawPlan.joins ?? []).map((join) => ({
      sourceTable: join.sourceTable,
      targetTable: join.targetTable,
      sourceColumn: join.sourceColumn,
      targetColumn: join.targetColumn,
      confidence: Number(join.confidence ?? 0),
      evidence: join.evidence ?? [],
      description: join.description ?? join.evidence?.[0] ?? ""
    })),
    filters: (rawPlan.filters ?? []).map((filter) =>
      typeof filter === "string"
        ? { expression: filter, confidence: 0.5, assumption: true }
        : {
            expression: filter.expression,
            confidence: Number(filter.confidence ?? 0.5),
            assumption: Boolean(filter.assumption ?? true)
          }
    ),
    metrics: (rawPlan.metrics ?? []).map((metric) => ({
      name: metric.name ?? metric.expression,
      expression: metric.expression ?? metric.name,
      sourceColumns: metric.sourceColumns ?? [],
      confidence: Number(metric.confidence ?? 0)
    })),
    assumptions: rawPlan.assumptions ?? [],
    confidence: Number(rawPlan.confidence ?? 0),
    limitations: rawPlan.limitations ?? [],
    joinPath: rawPlan.joinPath ?? (rawPlan.tables ?? []).map((table) => table.tableName),
    consideredTables: rawPlan.consideredTables ?? []
  };
}

async function callGrove(prompt, { maxOutputTokens = 1200 } = {}) {
  if (!groveConfigured()) {
    const error = new Error("Grove is required. Set GROVE_API_KEY in the demo runtime credentials.");
    error.code = "GROVE_REQUIRED";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.groveTimeoutMs);

  try {
    const response = await fetch(readGroveApiUrl(), {
      method: "POST",
      signal: controller.signal,
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
              "You are a metadata-grounded warehouse query planner for a MongoDB agentic metadata demo. Use only supplied metadata. Never invent tables, columns, joins, or metrics. Respond with strict JSON only."
          },
          { role: "user", content: prompt }
        ],
        max_output_tokens: maxOutputTokens,
        text: { format: { type: "text" } }
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
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(`Grove request timed out after ${env.groveTimeoutMs}ms`);
      timeoutError.code = "GROVE_TIMEOUT";
      throw timeoutError;
    }

    if (/fetch failed/i.test(error.message) || error.cause) {
      const networkError = new Error("Grove network request failed. Check GROVE_BASE_URL and runtime network access.");
      networkError.code = "GROVE_NETWORK_FAILED";
      throw networkError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function callGroveJson(prompt, schema, { retry = true } = {}) {
  const instruction = [
    prompt,
    "Return strict JSON only. Do not use markdown fences.",
    `JSON schema: ${JSON.stringify(schema)}`
  ].join("\n");

  try {
    return parseModelJson(await callGrove(instruction));
  } catch (error) {
    if (!retry) {
      const validationError = new Error(error.message);
      validationError.code = error.code === "LLM_JSON_PARSE_FAILED" ? "LLM_VALIDATION_FAILED" : error.code || "LLM_VALIDATION_FAILED";
      throw validationError;
    }

    const retryPrompt = [
      instruction,
      "Your previous response was invalid JSON. Return only a valid JSON object that matches the schema."
    ].join("\n");

    try {
      return parseModelJson(await callGrove(retryPrompt));
    } catch (retryError) {
      const validationError = new Error(retryError.message || error.message);
      validationError.code = "LLM_VALIDATION_FAILED";
      throw validationError;
    }
  }
}

export async function generateQueryPlanWithGrove({ question, metadataContext, tableCatalog, edgeCatalog }) {
  if (env.requireLlm && !groveConfigured()) {
    const error = new Error("REQUIRE_LLM=true but Grove is not configured.");
    error.code = "GROVE_REQUIRED";
    throw error;
  }

  if (!groveConfigured()) {
    return null;
  }

  const parsed = await callGroveJson(
    JSON.stringify(
      {
        task: "Build a metadata-grounded query plan.",
        question,
        metadataContext
      },
      null,
      2
    ),
    PLAN_JSON_SCHEMA
  );

  const normalized = normalizePlan(parsed);

  for (const tableEntry of normalized.tables) {
    const catalogTable = tableCatalog.find((table) => table.tableName === tableEntry.tableName);
    if (catalogTable) {
      tableEntry.schemaName = catalogTable.schemaName;
    }
  }

  return {
    ...normalized,
    ...validateQueryPlan(normalized, { question, tableCatalog, edgeCatalog })
  };
}

function buildDeterministicMongoAlternative(question, plan) {
  return {
    summary: "MongoDB can cache metadata-grounded query context for repeated agent lookups.",
    collections: ["metadata_query_context"],
    pipelineSketch: [
      { $match: { question } },
      { $project: { tables: plan.tables.map((table) => table.tableName), plan: 1 } }
    ]
  };
}

export async function generateAnswerWithGrove({ question, plan, sql, mongoAlternative, governance }) {
  if (!env.requireLlm || !groveConfigured()) {
    return null;
  }

  const answer = await callGrove(
    JSON.stringify(
      {
        task: "Write a concise executive answer using only supplied metadata evidence.",
        question,
        plan,
        sqlStatus: sql.status,
        mongoAlternative,
        governance
      },
      null,
      2
    )
  );

  if (!answer?.trim()) {
    const error = new Error("Grove returned an empty answer.");
    error.code = "LLM_VALIDATION_FAILED";
    throw error;
  }

  return answer.trim();
}

export async function generateMongoAlternativeWithGrove({ question, plan, tableCatalog }) {
  if (!env.requireLlm || !groveConfigured()) {
    return buildDeterministicMongoAlternative(question, plan);
  }

  const parsed = await callGroveJson(
    JSON.stringify(
      {
        task: "Suggest a MongoDB operational read model sketch grounded in the validated plan.",
        question,
        plan,
        allowedTables: tableCatalog.map((table) => table.tableName)
      },
      null,
      2
    ),
    {
      summary: "string",
      collections: ["string"],
      pipelineSketch: ["object"]
    }
  );

  return {
    summary: parsed.summary ?? "MongoDB can serve repeated operational read patterns from denormalized documents.",
    collections: parsed.collections ?? ["metadata_query_context"],
    pipelineSketch: parsed.pipelineSketch ?? buildDeterministicMongoAlternative(question, plan).pipelineSketch
  };
}

export async function callGroveForJson(prompt, schema = { entityNames: ["string"] }) {
  if (!env.requireLlm || !groveConfigured()) {
    return null;
  }

  return callGroveJson(prompt, schema);
}
