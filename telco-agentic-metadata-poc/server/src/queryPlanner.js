import { resolveJoinPath } from "./graphTraversal.js";

function normalize(text) {
  return String(text).toLowerCase();
}

function detectIntent(question) {
  const normalizedQuestion = normalize(question);

  if (
    normalizedQuestion.includes("high-value") &&
    normalizedQuestion.includes("billing") &&
    normalizedQuestion.includes("migration")
  ) {
    return "billing_issue_after_plan_migration";
  }

  if (normalizedQuestion.includes("highest churn risk") || normalizedQuestion.includes("churn risk last quarter")) {
    return "highest_churn_risk_last_quarter";
  }

  if (normalizedQuestion.includes("which tables") && normalizedQuestion.includes("plan migration")) {
    return "table_recommendation";
  }

  if (normalizedQuestion.includes("join path")) {
    return "join_path_lookup";
  }

  return "metadata_lookup";
}

function findTable(allTables, tableName) {
  return allTables.find((table) => table.tableName === tableName);
}

function tableReason(intent, tableName) {
  const reasons = {
    billing_issue_after_plan_migration: {
      customers: "Central customer entity used to anchor the business question.",
      customer_value_segments: "Required to identify the high-value cohort.",
      plan_migrations: "Required to isolate customers who migrated plans in the last 30 days.",
      billing_events: "Required to detect billing issues after migration."
    },
    highest_churn_risk_last_quarter: {
      accounts: "Central account entity for enterprise reporting.",
      churn_scores: "Contains the actual churn risk metric and score date.",
      usage_metrics: "Helpful follow-on table for operational drill-down, but not required for the top-line ranking."
    },
    table_recommendation: {
      customers: "Provides the common customer grain across domains.",
      plan_migrations: "Contains the migration event and date filter.",
      billing_events: "Contains the billing issue signal."
    },
    join_path_lookup: {
      customers: "Acts as the hub that connects customer-facing operational domains.",
      billing_events: "Contributes the billing issue event stream.",
      support_cases: "Contributes support interaction context."
    },
    metadata_lookup: {}
  };

  return reasons[intent]?.[tableName] ?? "Selected based on semantic relevance to the question.";
}

function buildPlanTables(intent, selectedTableNames, allTables) {
  return selectedTableNames
    .map((tableName) => findTable(allTables, tableName))
    .filter(Boolean)
    .map((table) => ({
      tableName: table.tableName,
      schemaName: table.schemaName,
      reason: tableReason(intent, table.tableName),
      rowCount: table.rowCount,
      primaryKeys: table.primaryKeys
    }));
}

function buildJoinObjects(joinEdges) {
  return joinEdges.map((edge) => ({
    sourceTable: edge.sourceTable,
    targetTable: edge.targetTable,
    sourceColumn: edge.sourceColumn,
    targetColumn: edge.targetColumn,
    description: edge.relationshipDescription,
    confidence: edge.confidence
  }));
}

function planForBillingIssueMigration(allTables, allEdges) {
  const requiredTables = [
    "customers",
    "customer_value_segments",
    "plan_migrations",
    "billing_events"
  ];
  const joinEdges = resolveJoinPath(requiredTables, allEdges);

  return {
    intent: "Count high-value customers with billing issues after a plan migration in the last 30 days",
    intentKey: "billing_issue_after_plan_migration",
    tables: buildPlanTables("billing_issue_after_plan_migration", requiredTables, allTables),
    joins: buildJoinObjects(joinEdges),
    filters: [
      "customer_value_segments.segment = 'High Value'",
      "plan_migrations.migration_date >= CURRENT_DATE - INTERVAL '30 days'",
      "billing_events.event_type = 'Billing Issue'"
    ],
    metrics: ["COUNT(DISTINCT customers.customer_id) AS affected_high_value_customers"],
    joinPath: requiredTables,
    consideredTables: ["support_cases"]
  };
}

function planForHighestChurn(allTables, allEdges) {
  const requiredTables = ["accounts", "churn_scores"];
  const joinEdges = resolveJoinPath(requiredTables, allEdges);

  return {
    intent: "Rank enterprise accounts by churn risk in the last quarter",
    intentKey: "highest_churn_risk_last_quarter",
    tables: buildPlanTables("highest_churn_risk_last_quarter", requiredTables, allTables),
    joins: buildJoinObjects(joinEdges),
    filters: [
      "accounts.segment = 'Enterprise'",
      "churn_scores.score_date >= DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '1 quarter'",
      "churn_scores.score_date < DATE_TRUNC('quarter', CURRENT_DATE)"
    ],
    metrics: ["MAX(churn_scores.churn_score) AS peak_churn_score"],
    joinPath: requiredTables,
    consideredTables: ["usage_metrics", "contract_renewals"]
  };
}

function planForTableRecommendation(allTables, allEdges) {
  const requiredTables = ["customers", "plan_migrations", "billing_events"];
  const joinEdges = resolveJoinPath(requiredTables, allEdges);

  return {
    intent: "Recommend the most relevant tables for billing issue analysis after plan migration",
    intentKey: "table_recommendation",
    tables: buildPlanTables("table_recommendation", requiredTables, allTables),
    joins: buildJoinObjects(joinEdges),
    filters: [
      "Use plan_migrations.migration_date to define the post-migration time window.",
      "Use billing_events.event_type to isolate billing issues."
    ],
    metrics: ["No metric yet; this is a schema-discovery request."],
    joinPath: requiredTables,
    consideredTables: ["customer_value_segments", "support_cases"]
  };
}

function planForJoinPath(question, allTables, allEdges) {
  const normalizedQuestion = normalize(question);
  const candidates = [
    normalizedQuestion.includes("customers") ? "customers" : null,
    normalizedQuestion.includes("billing events") ? "billing_events" : null,
    normalizedQuestion.includes("support cases") ? "support_cases" : null
  ].filter(Boolean);
  const requiredTables = candidates.length > 0 ? candidates : ["customers", "billing_events", "support_cases"];
  const joinEdges = resolveJoinPath(requiredTables, allEdges);

  return {
    intent: "Show the join path between the requested operational domains",
    intentKey: "join_path_lookup",
    tables: buildPlanTables("join_path_lookup", requiredTables, allTables),
    joins: buildJoinObjects(joinEdges),
    filters: ["No filter yet; this is a relationship-discovery request."],
    metrics: ["No metric yet; this is a join-path request."],
    joinPath: requiredTables,
    consideredTables: []
  };
}

function planForGenericLookup(retrievedTables, retrievedEdges, allTables, allEdges) {
  const requiredTables = retrievedTables.slice(0, 3).map((table) => table.tableName);
  const joinEdges =
    requiredTables.length > 1
      ? resolveJoinPath(requiredTables, allEdges)
      : retrievedEdges.slice(0, 3);

  return {
    intent: "Generic metadata lookup and query planning",
    intentKey: "metadata_lookup",
    tables: buildPlanTables("metadata_lookup", requiredTables, allTables),
    joins: buildJoinObjects(joinEdges),
    filters: ["Refine the question to get a more specific filter recommendation."],
    metrics: ["Select a metric after refining the question intent."],
    joinPath: requiredTables,
    consideredTables: []
  };
}

export function buildQueryPlan({ question, retrievedTables, retrievedEdges, allTables, allEdges }) {
  const intent = detectIntent(question);

  switch (intent) {
    case "billing_issue_after_plan_migration":
      return planForBillingIssueMigration(allTables, allEdges);
    case "highest_churn_risk_last_quarter":
      return planForHighestChurn(allTables, allEdges);
    case "table_recommendation":
      return planForTableRecommendation(allTables, allEdges);
    case "join_path_lookup":
      return planForJoinPath(question, allTables, allEdges);
    default:
      return planForGenericLookup(retrievedTables, retrievedEdges, allTables, allEdges);
  }
}
