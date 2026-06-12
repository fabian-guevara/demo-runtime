import { vectorSearchWithFallback } from "./vectorRetrieval.js";

export async function searchAccountContext({ query, region, segment, limit = 6 }) {
  const filter = {
    ...(region ? { region } : {}),
    ...(segment ? { segment } : {})
  };

  const support = await vectorSearchWithFallback({
    collectionName: "support_interactions",
    indexName: "support_interactions_vector_index",
    query,
    textField: "summary",
    filter,
    limit: Math.max(2, Math.ceil(limit / 2)),
    toolName: "searchAccountContext",
    name: "Vector search support_interactions",
    projection: {
      interactionId: 1,
      accountId: 1,
      region: 1,
      segment: 1,
      summary: 1,
      severity: 1,
      resolutionStatus: 1,
      sourceType: {
        $literal: "support_interaction"
      }
    }
  });

  const incidents = await vectorSearchWithFallback({
    collectionName: "incident_summaries",
    indexName: "incident_summaries_vector_index",
    query,
    textField: "summary",
    filter,
    limit: Math.max(2, Math.floor(limit / 2)),
    toolName: "searchAccountContext",
    name: "Vector search incident_summaries",
    projection: {
      incidentId: 1,
      region: 1,
      segment: 1,
      summary: 1,
      severity: 1,
      rootCause: 1,
      mitigation: 1,
      sourceType: {
        $literal: "incident_summary"
      }
    }
  });

  const context = [...support.docs, ...incidents.docs]
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
    .slice(0, limit);

  return {
    context,
    telemetryIds: [support.telemetryId, incidents.telemetryId].filter(Boolean),
    embeddingModel: support.embeddingModel ?? incidents.embeddingModel ?? "lexical-fallback",
    retrievalMode:
      support.retrievalMode === "vector" || incidents.retrievalMode === "vector" ? "vector" : "lexical"
  };
}
