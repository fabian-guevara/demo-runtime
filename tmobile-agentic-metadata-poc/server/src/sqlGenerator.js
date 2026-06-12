function sqlForIntent(queryPlan) {
  switch (queryPlan.intentKey) {
    case "billing_issue_after_plan_migration":
      return `SELECT
  COUNT(DISTINCT c.customer_id) AS affected_high_value_customers
FROM crm.customers c
JOIN crm.customer_value_segments cvs
  ON c.customer_id = cvs.customer_id
JOIN network.plan_migrations pm
  ON c.customer_id = pm.customer_id
JOIN billing.billing_events be
  ON c.customer_id = be.customer_id
WHERE
  cvs.segment = 'High Value'
  AND pm.migration_date >= CURRENT_DATE - INTERVAL '30 days'
  AND be.event_type = 'Billing Issue';`;
    case "highest_churn_risk_last_quarter":
      return `SELECT
  a.account_id,
  a.account_name,
  MAX(cs.churn_score) AS peak_churn_score
FROM crm.accounts a
JOIN risk.churn_scores cs
  ON a.account_id = cs.account_id
WHERE
  a.segment = 'Enterprise'
  AND cs.score_date >= DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '1 quarter'
  AND cs.score_date < DATE_TRUNC('quarter', CURRENT_DATE)
GROUP BY
  a.account_id,
  a.account_name
ORDER BY
  peak_churn_score DESC
LIMIT 25;`;
    case "table_recommendation":
      return `-- Suggested starting query skeleton
SELECT
  c.customer_id,
  c.customer_name,
  pm.migration_date,
  be.event_type,
  be.event_date
FROM crm.customers c
JOIN network.plan_migrations pm
  ON c.customer_id = pm.customer_id
JOIN billing.billing_events be
  ON c.customer_id = be.customer_id
WHERE
  be.event_type = 'Billing Issue';`;
    case "join_path_lookup":
      return `-- Join path only
SELECT
  c.customer_id,
  be.billing_event_id,
  sc.case_id
FROM crm.customers c
JOIN billing.billing_events be
  ON c.customer_id = be.customer_id
JOIN support.support_cases sc
  ON c.customer_id = sc.customer_id;`;
    default:
      return `-- Generic query draft
SELECT *
FROM ${queryPlan.tables[0]?.schemaName ?? "schema"}.${queryPlan.tables[0]?.tableName ?? "table"}
LIMIT 100;`;
  }
}

function explanationForPlan(queryPlan) {
  if (queryPlan.intentKey === "billing_issue_after_plan_migration") {
    return [
      "customers is required as the central customer entity.",
      "customer_value_segments is required to filter high-value customers.",
      "plan_migrations is required to identify customers who migrated plans.",
      "billing_events is required to detect billing issues.",
      "customer_id is the join key across these domains.",
      "support_cases was considered but not required unless the user asks for support interactions."
    ].join(" ");
  }

  if (queryPlan.intentKey === "highest_churn_risk_last_quarter") {
    return [
      "accounts is the reporting grain for enterprise analysis.",
      "churn_scores carries the risk metric and last-quarter time window.",
      "usage_metrics and contract_renewals are adjacent tables that can deepen follow-up analysis, but they are not required for the top-ranking question."
    ].join(" ");
  }

  if (queryPlan.intentKey === "table_recommendation") {
    return [
      "customers provides the common customer grain.",
      "plan_migrations isolates the migration event.",
      "billing_events isolates the billing issue signal.",
      "customer_value_segments and support_cases remain optional depending on whether the business user adds value-segment or support-context filters."
    ].join(" ");
  }

  if (queryPlan.intentKey === "join_path_lookup") {
    return [
      "customers acts as the hub table.",
      "billing_events and support_cases both connect through customer_id.",
      "The shortest join path stays at the customer grain instead of inventing a direct billing-to-support relationship."
    ].join(" ");
  }

  return "The plan is based on the highest-scoring metadata matches and the available relationship graph.";
}

function mongoAlternativeForPlan(queryPlan) {
  if (queryPlan.intentKey === "billing_issue_after_plan_migration") {
    return {
      collection: "customer_activity_summary",
      documentShape: {
        customer_id: "string",
        customer_name: "string",
        value_segment: "string",
        recent_plan_migrations: [
          {
            migration_date: "date",
            old_plan_id: "string",
            new_plan_id: "string"
          }
        ],
        recent_billing_events: [
          {
            event_date: "date",
            event_type: "string",
            severity: "string"
          }
        ],
        open_support_cases: [
          {
            case_id: "string",
            status: "string",
            case_category: "string"
          }
        ],
        last_updated: "timestamp"
      },
      reason:
        "For repeated operational chatbot queries, precomputing a customer activity summary can reduce multi-table joins and improve read latency."
    };
  }

  if (queryPlan.intentKey === "highest_churn_risk_last_quarter") {
    return {
      collection: "account_risk_snapshot",
      documentShape: {
        account_id: "string",
        account_name: "string",
        segment: "string",
        latest_churn_scores: [
          {
            score_date: "date",
            churn_score: "decimal",
            risk_band: "string"
          }
        ],
        recent_usage_metrics: [
          {
            metric_date: "date",
            avg_latency_ms: "number",
            dropped_call_rate: "decimal"
          }
        ],
        contract_renewal: {
          renewal_date: "date",
          renewal_status: "string"
        }
      },
      reason:
        "For repeated risk monitoring, an account-centric document can keep churn context, usage, and renewal posture together for faster application reads."
    };
  }

  return {
    collection: "metadata_query_context",
    documentShape: {
      question: "string",
      retrieved_tables: ["string"],
      retrieved_edges: ["string"],
      recommended_query_templates: ["string"],
      last_updated: "timestamp"
    },
    reason:
      "For discovery workflows, a metadata-centric document model can cache join recommendations and shorten repeated planning requests."
  };
}

export function buildDeterministicArtifacts(queryPlan) {
  return {
    generatedSql: sqlForIntent(queryPlan),
    explanation: explanationForPlan(queryPlan),
    mongoAlternative: mongoAlternativeForPlan(queryPlan)
  };
}
