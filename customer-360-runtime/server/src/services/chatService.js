import crypto from "node:crypto";
import env from "../config/env.js";
import { callGrove, groveConfigured, readGroveModel } from "./groveClient.js";
import { callMcpTool, withMcpSession } from "./mcpClient.js";
import { customTools } from "./searchTools.js";
import { trackedRuntimeAction } from "../../../.demo/runtime-tracker.js";

const DEFAULT_MAX_AGENT_STEPS = 15;
const DEFAULT_ANSWER_ONLY_STEPS = 2;
const DEFAULT_DUPLICATE_STOP_THRESHOLD = 3;
const DEFAULT_MAX_TOOL_RESULT_CHARS = 6000;

function readAgentBudget() {
  return {
    maxSteps: Math.max(
      1,
      Number(process.env.CHAT_MAX_TOOL_ITERATIONS ?? env.chatMaxToolIterations ?? DEFAULT_MAX_AGENT_STEPS)
    ),
    answerOnlySteps: Math.max(
      1,
      Number(process.env.CHAT_FORCE_ANSWER_WHEN_REMAINING ?? env.chatForceAnswerWhenRemaining ?? DEFAULT_ANSWER_ONLY_STEPS)
    ),
    duplicateStopThreshold: Math.max(
      2,
      Number(process.env.CHAT_DUPLICATE_STOP_THRESHOLD ?? env.chatDuplicateStopThreshold ?? DEFAULT_DUPLICATE_STOP_THRESHOLD)
    ),
    maxToolResultChars: Math.max(
      1000,
      Number(process.env.CHAT_MAX_TOOL_RESULT_CHARS ?? env.chatMaxToolResultChars ?? DEFAULT_MAX_TOOL_RESULT_CHARS)
    )
  };
}

function stripCodeFence(text) {
  return String(text)
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseBalancedJsonObject(text, startIndex = 0) {
  const start = text.indexOf("{", startIndex);
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return parseBalancedJsonObject(text, start + 1);
        }
      }
    }
  }

  return null;
}

function parseAgentDecision(text) {
  const cleaned = stripCodeFence(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const parsed = parseBalancedJsonObject(cleaned);
    if (parsed) {
      return parsed;
    }

    throw new Error("Invalid agent JSON");
  }
}

function safeJsonParse(text) {
  return parseAgentDecision(text);
}

function looksLikeInternalAgentJson(text) {
  const cleaned = stripCodeFence(text);
  if (!cleaned.startsWith("{")) {
    return false;
  }

  return /"action"\s*:\s*"(tool|answer)"/.test(cleaned);
}

function isToolDecision(decision) {
  return decision?.action === "tool" && typeof decision?.name === "string" && decision.name.length > 0;
}

function isAnswerDecision(decision) {
  return decision?.action === "answer";
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function buildToolSignature(name, args = {}) {
  return `${name}::${stableStringify(args)}`;
}

function truncateForPrompt(value, maxChars) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (serialized.length <= maxChars) {
    return serialized;
  }

  return `${serialized.slice(0, maxChars)}\n... [truncated ${serialized.length - maxChars} characters]`;
}

function compactToolCallsForPrompt(toolCalls, maxChars) {
  return truncateForPrompt(toolCalls, maxChars);
}

function buildToolCatalog(mcpTools) {
  const mcpEntries = mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
    source: "mcp"
  }));

  const customEntries = Object.entries(customTools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: tool.parameters,
    source: "custom"
  }));

  return [...mcpEntries, ...customEntries];
}

function inferCollectionName(toolName, args = {}) {
  if (args.collection) {
    return args.collection;
  }

  if (toolName.includes("manual") || toolName.includes("search") || toolName.includes("kb") || toolName.includes("care")) {
    return "care_kb";
  }

  if (toolName.includes("customer") || toolName.includes("lookup") || toolName.includes("segment")) {
    return "customers";
  }

  if (toolName.includes("interaction") || toolName.includes("ticket")) {
    return "interactions";
  }

  return "unknown";
}

function validateToolRequest(name, args, mcpToolNames) {
  if (!name || typeof name !== "string") {
    return { ok: false, error: "Tool name is required." };
  }

  if (args !== undefined && (args === null || typeof args !== "object" || Array.isArray(args))) {
    return { ok: false, error: "Tool arguments must be a JSON object." };
  }

  if (!customTools[name] && !mcpToolNames.has(name)) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }

  return { ok: true };
}

async function executeTool({ db, client, mcpToolNames }, name, args) {
  if (customTools[name]) {
    return customTools[name].handler({ db }, args ?? {});
  }

  if (!mcpToolNames.has(name)) {
    throw new Error(`Unknown tool: ${name}`);
  }

  return callMcpTool(client, name, args ?? {});
}

async function loadHistory(db, sessionId, limit = 8) {
  const messages = await db
    .collection("chat_messages")
    .find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return messages.reverse();
}

async function saveHistory(db, sessionId, role, content, metadata = {}) {
  await db.collection("chat_messages").insertOne({
    sessionId,
    role,
    content,
    metadata,
    createdAt: new Date().toISOString()
  });
}

function buildAgentSystemPrompt({ answerOnlyMode }) {
  const lines = [
    "You are a MongoDB customer 360 agent for a T-Mobile-style care and retention demo with 1M+ customer records.",
    "Use MCP MongoDB tools plus custom search tools when needed.",
    "Respond with strict JSON only.",
    "Prefer lookup_customer_tool and segment_insights_tool for targeted customer work.",
    "For a named customer or phone number, call lookup_customer_tool before writing large aggregate pipelines.",
    "Use MCP aggregate/find/count on customers and interactions for cohort analysis across the full dataset.",
    "Use custom search tools for care_kb retention and escalation guidance.",
    "Stop calling tools once you have enough evidence to answer the operator.",
    "Every tool call must receive exactly one structured result. Reuse prior results instead of repeating identical calls.",
    `LLM model: ${readGroveModel()}.`
  ];

  if (answerOnlyMode) {
    lines.push(
      'You MUST respond with {"action":"answer","content":"markdown answer for the operator"} and MUST NOT call any more tools.'
    );
  } else {
    lines.push(
      'Either {"action":"tool","name":"<tool_name>","arguments":{...}}',
      'or {"action":"answer","content":"markdown answer for the operator"}.'
    );
  }

  return lines.join("\n");
}

function buildAgentUserPrompt({
  toolCatalog,
  transcript,
  toolCalls,
  maxToolResultChars,
  options = {}
}) {
  const { stepsRemaining = null, loopNotice = "" } = options;
  const lines = [
    "Available tools:",
    truncateForPrompt(toolCatalog, maxToolResultChars),
    "",
    "Conversation:",
    transcript,
    "",
    toolCalls.length
      ? `Tool results so far:\n${compactToolCallsForPrompt(toolCalls, maxToolResultChars)}`
      : "No tool results yet.",
    "",
    "Decide the next action."
  ];

  if (typeof stepsRemaining === "number" && stepsRemaining <= 2) {
    lines.push(
      "",
      `Budget warning: only ${stepsRemaining} agent step${stepsRemaining === 1 ? "" : "s"} remain before the server forces a final answer. Answer now if you have enough evidence.`
    );
  }

  if (loopNotice) {
    lines.push("", loopNotice);
  }

  return lines.join("\n");
}

async function requestAgentDecision({
  transcript,
  toolCatalog,
  toolCalls,
  maxToolResultChars,
  answerOnlyMode = false,
  stepsRemaining = null,
  loopNotice = ""
}) {
  return callGrove({
    maxOutputTokens: answerOnlyMode ? 1400 : 3200,
    systemPrompt: buildAgentSystemPrompt({ answerOnlyMode }),
    userPrompt: buildAgentUserPrompt({
      toolCatalog,
      transcript,
      toolCalls,
      maxToolResultChars,
      options: {
        stepsRemaining,
        loopNotice
      }
    })
  });
}

function extractAnswerFromDecision(text, decision) {
  if (isAnswerDecision(decision)) {
    return String(decision.content ?? "").trim();
  }

  // Never surface internal tool-call JSON to the operator UI.
  if (isToolDecision(decision) || looksLikeInternalAgentJson(text)) {
    return "";
  }

  return String(text).trim();
}

async function requestForcedFinalAnswer({
  message,
  transcript,
  toolCatalog,
  toolCalls,
  maxToolResultChars,
  reason
}) {
  const { text } = await requestAgentDecision({
    transcript: [
      transcript,
      "",
      "SYSTEM: You reached the maximum number of agent steps.",
      `SYSTEM: ${reason}`,
      "SYSTEM: Provide your best markdown answer now based on the work completed so far. Do not call any more tools."
    ].join("\n"),
    toolCatalog,
    toolCalls,
    maxToolResultChars,
    answerOnlyMode: true,
    loopNotice: `Original question: ${message}`
  });

  try {
    const decision = safeJsonParse(text);
    const answer = extractAnswerFromDecision(text, decision);
    if (answer) {
      return answer;
    }
  } catch (error) {
    const answer = extractAnswerFromDecision(text, null);
    if (answer && !looksLikeInternalAgentJson(answer)) {
      return answer;
    }
  }

  return "";
}

async function synthesizeFinalAnswer({ message, transcript, toolCalls, maxToolResultChars, reason }) {
  const { text } = await callGrove({
    maxOutputTokens: 1400,
    systemPrompt: [
      "You are a MongoDB customer 360 agent for a T-Mobile-style care and retention demo.",
      "Write a clear markdown answer for the operator using only the conversation and tool results provided.",
      "Do not request tools. Do not output JSON.",
      "Base the answer on observed tool results, not assumptions about tool success.",
      "If evidence is incomplete, summarize what was found and what remains unknown.",
      `Reason for synthesis: ${reason}.`
    ].join("\n"),
    userPrompt: [
      "Original question:",
      message,
      "",
      "Conversation:",
      transcript,
      "",
      toolCalls.length
        ? `Tool results:\n${compactToolCallsForPrompt(toolCalls, maxToolResultChars)}`
        : "No tool results were collected.",
      "",
      "Provide the final operator-facing markdown answer."
    ].join("\n")
  });

  return String(text).trim();
}

function appendToolObservation(toolCalls, observation) {
  toolCalls.push(observation);
  return observation;
}

async function recordToolCall(
  { db, client, mcpToolNames, toolCalls, toolSignatures, duplicateStopThreshold },
  name,
  toolArgs
) {
  const validation = validateToolRequest(name, toolArgs, mcpToolNames);
  if (!validation.ok) {
    return appendToolObservation(toolCalls, {
      name,
      arguments: toolArgs ?? {},
      result: {
        error: true,
        code: "INVALID_TOOL_REQUEST",
        message: validation.error
      },
      durationMs: 0,
      validationError: true
    });
  }

  const signature = buildToolSignature(name, toolArgs);
  const signatureCount = (toolSignatures.get(signature) ?? 0) + 1;
  toolSignatures.set(signature, signatureCount);

  if (signatureCount > 1) {
    appendToolObservation(toolCalls, {
      name,
      arguments: toolArgs,
      result: {
        duplicate: true,
        code: "DUPLICATE_TOOL_CALL",
        message:
          "This exact tool call was already executed in this turn. Reuse the earlier result instead of repeating it."
      },
      durationMs: 0,
      duplicate: true
    });

    return {
      duplicate: true,
      signatureCount,
      loopNotice:
        signatureCount === 2
          ? "You repeated an identical tool call. Reuse prior results instead of calling the same tool with the same arguments again."
          : "",
      stopLoop: signatureCount >= duplicateStopThreshold
    };
  }

  const started = performance.now();

  try {
    const result = await executeTool({ db, client, mcpToolNames }, name, toolArgs);
    const durationMs = Math.round(performance.now() - started);

    appendToolObservation(toolCalls, {
      name,
      arguments: toolArgs,
      result,
      durationMs
    });

    await trackedRuntimeAction({
      name: `Tool ${name}`,
      toolName: name,
      dbName: toolArgs.database ?? db.databaseName,
      collectionName: inferCollectionName(name, toolArgs),
      operation: name,
      query: toolArgs,
      metadata: { durationMs },
      run: async () => result
    });

    return {
      duplicate: false,
      signatureCount,
      loopNotice: "",
      stopLoop: false
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - started);

    appendToolObservation(toolCalls, {
      name,
      arguments: toolArgs,
      result: {
        error: true,
        code: error.code ?? "TOOL_EXECUTION_FAILED",
        message: error.message
      },
      durationMs
    });

    return {
      duplicate: false,
      signatureCount,
      loopNotice: "",
      stopLoop: false
    };
  }
}

export async function runChat({ db, message, sessionId = crypto.randomUUID() }) {
  if (!groveConfigured()) {
    const error = new Error("Grove is required. Set GROVE_API_KEY in demo runtime credentials.");
    error.code = "GROVE_NOT_CONFIGURED";
    throw error;
  }

  const budget = readAgentBudget();
  const toolCalls = [];
  const toolSignatures = new Map();
  const history = await loadHistory(db, sessionId);
  await saveHistory(db, sessionId, "user", message);

  return withMcpSession(async ({ client, tools }) => {
    const mcpToolNames = new Set(tools.map((tool) => tool.name));
    const toolCatalog = buildToolCatalog(tools);
    const transcript = [
      ...history.map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`),
      `USER: ${message}`
    ].join("\n\n");

    let finalAnswer = "";
    let completionReason = "step_budget_exhausted";
    let stepCount = 0;
    let stopReason = completionReason;
    let loopNotice = "";

    for (let step = 0; step < budget.maxSteps; step += 1) {
      stepCount = step + 1;
      const stepsRemaining = budget.maxSteps - step - 1;
      const answerOnlyMode = stepsRemaining < budget.answerOnlySteps;

      const { text } = await requestAgentDecision({
        transcript,
        toolCatalog,
        toolCalls,
        maxToolResultChars: budget.maxToolResultChars,
        answerOnlyMode,
        stepsRemaining,
        loopNotice
      });

      loopNotice = "";

      let decision;
      try {
        decision = safeJsonParse(text);
      } catch (error) {
        if (looksLikeInternalAgentJson(text)) {
          loopNotice =
            "Your previous response looked like a tool call but was not valid JSON. Reply with strict JSON only.";
          continue;
        }

        if (answerOnlyMode) {
          finalAnswer = extractAnswerFromDecision(text, null);
          completionReason = finalAnswer ? "forced_answer_text" : "invalid_forced_answer";
          break;
        }

        completionReason = "invalid_agent_json";
        loopNotice = "Reply with strict JSON only: either an answer or one tool call.";
        continue;
      }

      if (isAnswerDecision(decision)) {
        finalAnswer = extractAnswerFromDecision(text, decision);
        completionReason = answerOnlyMode ? "forced_answer" : "answer";
        break;
      }

      if (!isToolDecision(decision)) {
        if (looksLikeInternalAgentJson(text)) {
          loopNotice = "Tool calls must include action, name, and arguments as valid JSON.";
          continue;
        }

        finalAnswer = extractAnswerFromDecision(text, decision);
        completionReason = "plain_text_answer";
        break;
      }

      if (answerOnlyMode) {
        stopReason = "agent_requested_tool_after_budget";
        break;
      }

      const execution = await recordToolCall(
        {
          db,
          client,
          mcpToolNames,
          toolCalls,
          toolSignatures,
          duplicateStopThreshold: budget.duplicateStopThreshold
        },
        decision.name,
        decision.arguments ?? {}
      );

      loopNotice = execution.loopNotice;

      if (execution.stopLoop) {
        stopReason = "no_progress";
        break;
      }
    }

    if (!finalAnswer) {
      finalAnswer = await requestForcedFinalAnswer({
        message,
        transcript,
        toolCatalog,
        toolCalls,
        maxToolResultChars: budget.maxToolResultChars,
        reason: stopReason
      });
      completionReason = "early_stopping_generate";
    }

    if (!finalAnswer || looksLikeInternalAgentJson(finalAnswer)) {
      finalAnswer = await synthesizeFinalAnswer({
        message,
        transcript,
        toolCalls,
        maxToolResultChars: budget.maxToolResultChars,
        reason: stopReason
      });
      completionReason = "synthesis";
    }

    if (looksLikeInternalAgentJson(finalAnswer)) {
      finalAnswer =
        "I ran the MongoDB tools for your request, but could not format a clean operator summary. Check the Mongo terminal below for query results.";
      completionReason = "sanitized_fallback";
    }

    await saveHistory(db, sessionId, "assistant", finalAnswer, {
      toolCalls,
      llmModel: readGroveModel(),
      completionReason,
      stepCount,
      maxSteps: budget.maxSteps,
      stopReason
    });

    return {
      sessionId,
      answer: finalAnswer,
      toolCalls,
      llmModel: readGroveModel(),
      completionReason,
      stepCount,
      maxSteps: budget.maxSteps,
      stopReason,
      synthesized: completionReason === "synthesis" || completionReason === "early_stopping_generate"
    };
  });
}
