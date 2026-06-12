import crypto from "node:crypto";

function summarizeMongoTarget(error) {
  const uri = process.env.MONGODB_URI || "";

  if (!uri) {
    const message = error?.message || "";
    const messageMatch = message.match(/\b([a-z0-9.-]+\.[a-z0-9.-]+:\d+)\b/i);
    return messageMatch?.[1] ?? null;
  }

  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?]+)/i);
  return match?.[1] ?? null;
}

function classifyError(error, context = {}) {
  const message = error?.message || "Unknown error";
  const source = context.source || "application";
  const lowerMessage = message.toLowerCase();

  if (
    source === "llm" ||
    error?.code === "LLM_VALIDATION_FAILED" ||
    /grove|openai|anthropic|bedrock|model|llm|json parse|unterminated string in json|unexpected token/i.test(
      message
    )
  ) {
    return {
      source: "llm",
      category: /json|validation/i.test(message) || error?.code === "LLM_VALIDATION_FAILED" ? "json-parse" : "generation",
      hint: "The Grove generation step failed. Check GROVE_API_KEY, GROVE_MODEL, and GROVE_API_URL (or GROVE_BASE_URL alias) in the runtime credentials."
    };
  }

  if (
    source === "mongodb" ||
    error?.name?.includes("Mongo") ||
    /server selection|enetunreach|econnrefused|etimedout|mongodb_uri|authentication failed/i.test(message)
  ) {
    if (/enetunreach|ehostunreach|etimedout|server selection/i.test(lowerMessage)) {
      return {
        source: "mongodb",
        category: "connectivity",
        hint: `MongoDB connectivity issue. Check MONGODB_URI, network reachability, allowlists, and cluster status.${summarizeMongoTarget(error) ? ` Target: ${summarizeMongoTarget(error)}.` : ""}`
      };
    }

    if (/authentication failed|bad auth|auth/i.test(lowerMessage)) {
      return {
        source: "mongodb",
        category: "authentication",
        hint: `MongoDB authentication failed. Check the username, password, auth database, and IP/network access.${summarizeMongoTarget(error) ? ` Target: ${summarizeMongoTarget(error)}.` : ""}`
      };
    }

    if (/mongodb_uri is required/i.test(lowerMessage)) {
      return {
        source: "mongodb",
        category: "configuration",
        hint: "Set MONGODB_URI before running the demo."
      };
    }

    return {
      source: "mongodb",
      category: "query",
      hint: "MongoDB returned an error while the app was reading metadata or saving query runs."
    };
  }

  if (source === "voyage" || /voyage|embedding|embeddings_unavailable/i.test(lowerMessage)) {
    return {
      source: "voyage",
      category: "embedding",
      hint: "Embedding generation failed. Configure VOYAGE_API_KEY or allow lexical degraded mode unless REQUIRE_EMBEDDINGS=true."
    };
  }

  if (/require_vector_search|vector_search_unavailable/i.test(lowerMessage)) {
    return {
      source: "retrieval",
      category: "vector-search",
      hint: "Vector search is required but unavailable. Create Atlas Vector Search indexes or set REQUIRE_VECTOR_SEARCH=false."
    };
  }

  return {
    source,
    category: context.category || "application",
    hint: context.hint || "Check the server log for the full stack trace."
  };
}

export function buildErrorPayload(error, context = {}) {
  const requestId = context.requestId || crypto.randomUUID();
  const classification = classifyError(error, context);

  return {
    error: error?.message || "Unknown error",
    source: classification.source,
    category: classification.category,
    operation: context.operation || "unknown",
    code: error?.code || error?.name || "UNKNOWN_ERROR",
    hint: classification.hint,
    requestId,
    details: {
      target: classification.source === "mongodb" ? summarizeMongoTarget(error) : null,
      route: context.route || null
    }
  };
}

export function logStructuredError(error, context = {}) {
  const payload = buildErrorPayload(error, context);

  console.error("[error]", JSON.stringify(payload));
  if (error?.stack) {
    console.error(error.stack);
  }

  return payload;
}
