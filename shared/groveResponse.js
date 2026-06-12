/**
 * Parse Grove Gateway OpenAI Responses API payloads.
 *
 * Verified shape (2026-06-04):
 *   response.output[].type === "message"
 *   response.output[].content[].type === "output_text"
 *   response.output[].content[].text === "..."
 *
 * Note: response.text is a config object ({ format, verbosity }), not assistant text.
 */
export function describeGroveOutput(payload) {
  return (payload?.output ?? []).map((item) => ({
    type: item?.type ?? null,
    role: item?.role ?? null,
    status: item?.status ?? null,
    contentTypes: (item?.content ?? []).map((part) => part?.type ?? null)
  }));
}

export function extractGroveResponseText(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  if (typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }

  const chunks = [];

  for (const item of payload.output ?? []) {
    if (item?.type !== "message") {
      continue;
    }

    for (const part of item.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

export function assertGroveResponseHasText(payload) {
  const text = extractGroveResponseText(payload);

  if (text) {
    return text;
  }

  const error = new Error(
    `Grove returned no assistant text. output=${JSON.stringify(describeGroveOutput(payload))}`
  );
  error.code = "GROVE_EMPTY_RESPONSE";
  error.responseStatus = payload?.status ?? null;
  error.responseId = payload?.id ?? null;
  throw error;
}
