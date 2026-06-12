import crypto from "node:crypto";
import { previousDemoMonth, latestDemoMonth } from "../data/sampleData.js";
import { generateNarrative, groveConfigured } from "./groveClient.js";
import { callTool } from "./toolRegistry.js";
import { resolveFollowUp, saveTurn, getConversationState } from "./shortTermMemoryService.js";

function parseRegion(message, fallback = "Texas") {
  const normalized = message.toLowerCase();
  if (normalized.includes("california")) return "California";
  if (normalized.includes("florida")) return "Florida";
  if (normalized.includes("illinois")) return "Illinois";
  if (normalized.includes("washington")) return "Washington";
  return fallback;
}

function parseSegment(message, fallback = "enterprise") {
  const normalized = message.toLowerCase();
  if (normalized.includes("small-business")) return "small-business";
  if (normalized.includes("mid-market")) return "mid-market";
  return fallback;
}

function namespaceForUser(userId) {
  return ["user", userId];
}

function asksForHelp(normalized) {
  return (
    /\bhelp\b/.test(normalized) ||
    /\bwhat can you do\b/.test(normalized) ||
    /\bwhat do you do\b/.test(normalized) ||
    /\bwhat can you help\b/.test(normalized) ||
    (/\bdescribe\b/.test(normalized) && /\bhelp\b/.test(normalized)) ||
    /\bcapabilit(y|ies)\b/.test(normalized)
  );
}

function asksForChurn(normalized) {
  return (
    /\bchurn\b/.test(normalized) ||
    /\brisk\b/.test(normalized) ||
    /\brevenue at risk\b/.test(normalized) ||
    /\bnps\b/.test(normalized)
  );
}

function asksForLatestAccount(normalized) {
  return (
    /\b(latest|newest|most recent|recent)\b/.test(normalized) &&
    /\b(account|customer)\b/.test(normalized) &&
    (/\bbilling disputes?\b/.test(normalized) ||
      /\bnetwork incidents?\b/.test(normalized) ||
      /\bsupport tickets?\b/.test(normalized) ||
      /\bissue\b/.test(normalized))
  );
}

function parseIssueType(message) {
  const normalized = message.toLowerCase();
  if (/\bbilling disputes?\b/.test(normalized) || /\bbilling\b/.test(normalized)) {
    return "billing";
  }

  if (/\bnetwork incidents?\b/.test(normalized) || /\bnetwork\b/.test(normalized)) {
    return "network";
  }

  if (/\bsupport tickets?\b/.test(normalized) || /\bsupport\b/.test(normalized)) {
    return "support";
  }

  return "billing";
}

function detectIntent(message) {
  const normalized = message.toLowerCase();

  if (asksForHelp(normalized)) {
    return "capabilities";
  }

  if (normalized.startsWith("remember") || normalized.includes("leadership cares")) {
    return "rememberPreference";
  }

  if (asksForLatestAccount(normalized)) {
    return "getLatestAccountIssue";
  }

  if (normalized.includes("compare") || normalized.includes("last month")) {
    return "compareChurnRisk";
  }

  if (
    normalized.includes("evidence supports") ||
    normalized.includes("what evidence") ||
    normalized.includes("supports that")
  ) {
    return "supportingEvidence";
  }

  if (normalized.includes("segment") && normalized.includes("region")) {
    return "getCustomerSegments";
  }

  if (asksForChurn(normalized)) {
    return "getChurnRisk";
  }

  return "general";
}

async function generateAnswer({
  intent,
  metrics,
  comparison,
  retrievedContext,
  longTermMemories,
  latestAccountIssue,
  segmentsData,
  resolvedContext,
  message
}) {
  if (!groveConfigured()) {
    const error = new Error("Grove is required for this demo response but is not configured.");
    error.code = "GROVE_REQUIRED";
    throw error;
  }

  const prompt = JSON.stringify(
    {
      intent,
      message,
      resolvedContext,
      metrics,
      comparison,
      retrievedContext,
      longTermMemories,
      latestAccountIssue,
      segmentsData
    },
    null,
    2
  );

  try {
    const result = await generateNarrative({
      systemPrompt:
        "You are a precise telecom analytics assistant for a MongoDB demo. Use only the supplied facts. Never invent metrics. Mention leadership preferences when provided. For capability or general questions, explain what the demo can do and suggest concrete example prompts.",
      userPrompt: `Turn the following structured telecom analytics results into a concise executive answer:\n${prompt}`
    });

    if (!result.text?.trim()) {
      throw new Error("Grove returned an empty response.");
    }

    return result.text;
  } catch (error) {
    const wrapped = new Error(`Grove response generation failed: ${error.message}`);
    wrapped.code = error.code ?? "GROVE_REQUEST_FAILED";
    throw wrapped;
  }
}

export async function handleChat({ conversationId, userId = "demo-user", message }) {
  const activeConversationId = conversationId || crypto.randomUUID();
  const resolvedFromMemory = await resolveFollowUp(activeConversationId, message);
  const conversationState = await getConversationState(activeConversationId);
  const fallbackContext = conversationState?.lastResolvedContext ?? {
    region: "Texas",
    segment: "enterprise",
    month: latestDemoMonth()
  };
  const resolvedContext = {
    region: parseRegion(message, resolvedFromMemory?.region ?? fallbackContext.region),
    segment: parseSegment(message, resolvedFromMemory?.segment ?? fallbackContext.segment),
    month: resolvedFromMemory?.month ?? fallbackContext.month ?? latestDemoMonth()
  };
  const intent = detectIntent(message);
  const toolCalls = [];
  const telemetryIds = [];
  let metrics = null;
  let comparison = null;
  let segmentsData = null;
  let latestAccountIssue = null;
  let retrievedContext = [];
  let shortTermMemoryUsed = resolvedFromMemory
    ? {
        resolvedFrom: "conversation checkpoint",
        resolvedContext: resolvedFromMemory
      }
    : null;
  let longTermMemoryUsed = [];

  if (intent === "rememberPreference") {
    const rememberCall = await callTool("rememberPreference", {
      userId,
      namespace: namespaceForUser(userId),
      key: "texas-enterprise-risk-preferences",
      memoryText: message.replace(/^remember\s*/i, ""),
      metadata: {
        region: resolvedContext.region,
        segment: resolvedContext.segment,
        memoryType: "preference",
        userId
      }
    });
    toolCalls.push(rememberCall);
    telemetryIds.push(rememberCall.output.telemetryId);
  } else if (intent !== "capabilities" && intent !== "general") {
    const memorySearch = await callTool("searchLongTermMemory", {
      userId,
      namespace: namespaceForUser(userId),
      query: message,
      limit: 3
    });
    toolCalls.push(memorySearch);
    if (memorySearch.output.telemetryId) telemetryIds.push(memorySearch.output.telemetryId);
    longTermMemoryUsed = memorySearch.output.memories ?? [];
  }

  if (intent === "getChurnRisk") {
    const churnCall = await callTool("getChurnRisk", resolvedContext);
    toolCalls.push(churnCall);
    telemetryIds.push(churnCall.output.telemetryId);
    metrics = churnCall.output;

    const contextCall = await callTool("searchAccountContext", {
      query: [
        message,
        `${resolvedContext.region} ${resolvedContext.segment} churn risk`,
        `top drivers ${metrics.topRiskDrivers.join(" ")}`,
        `high risk accounts ${metrics.highRiskAccounts.map((account) => account.accountName).join(" ")}`
      ].join(". "),
      region: resolvedContext.region,
      segment: resolvedContext.segment,
      limit: 6
    });
    toolCalls.push(contextCall);
    telemetryIds.push(...(contextCall.output.telemetryIds ?? []));
    retrievedContext = contextCall.output.context ?? [];
  }

  if (intent === "compareChurnRisk") {
    const comparisonCall = await callTool("compareChurnRisk", {
      region: resolvedContext.region,
      segment: resolvedContext.segment,
      currentMonth: resolvedContext.month ?? latestDemoMonth(),
      previousMonth: previousDemoMonth()
    });
    toolCalls.push(comparisonCall);
    telemetryIds.push(comparisonCall.output.telemetryId);
    comparison = comparisonCall.output;
    resolvedContext.previousMonth = comparison.previousMonth;
  }

  if (intent === "getLatestAccountIssue") {
    const latestIssueCall = await callTool("getLatestAccountIssue", {
      region: resolvedContext.region,
      segment: resolvedContext.segment,
      month: resolvedContext.month,
      issueType: parseIssueType(message)
    });
    toolCalls.push(latestIssueCall);
    telemetryIds.push(latestIssueCall.output.telemetryId);
    latestAccountIssue = latestIssueCall.output;
    retrievedContext = latestIssueCall.output.latestIssue
      ? [
          {
            ...latestIssueCall.output.latestIssue,
            score: 1,
            sourceType: "latest_account_issue"
          }
        ]
      : [];
  }

  if (intent === "supportingEvidence") {
    const contextCall = await callTool("searchAccountContext", {
      query: [
        message,
        `${resolvedContext.region} ${resolvedContext.segment} churn risk evidence`,
        "billing disputes NPS drops network incidents"
      ].join(". "),
      region: resolvedContext.region,
      segment: resolvedContext.segment,
      limit: 6
    });
    toolCalls.push(contextCall);
    telemetryIds.push(...(contextCall.output.telemetryIds ?? []));
    retrievedContext = contextCall.output.context ?? [];
  }

  if (intent === "getCustomerSegments") {
    const segmentsCall = await callTool("getCustomerSegments", {});
    toolCalls.push(segmentsCall);
    telemetryIds.push(segmentsCall.output.telemetryId);
    segmentsData = segmentsCall.output;
  }

  const answer = await generateAnswer({
    intent,
    metrics,
    comparison,
    retrievedContext,
    longTermMemories: longTermMemoryUsed,
    latestAccountIssue,
    segmentsData,
    resolvedContext,
    message
  });

  await saveTurn(
    activeConversationId,
    message,
    toolCalls.map((call) => ({ name: call.name, input: call.input })),
    answer,
    resolvedContext
  );

  return {
    conversationId: activeConversationId,
    answer,
    metrics: metrics ?? comparison ?? null,
    latestAccountIssue,
    retrievedContext,
    shortTermMemoryUsed,
    longTermMemoryUsed,
    toolCalls,
    telemetryIds
  };
}
