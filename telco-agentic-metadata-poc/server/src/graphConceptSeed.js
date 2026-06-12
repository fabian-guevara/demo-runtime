export function createGraphConceptEntities(tables) {
  const tableNames = new Set(tables.map((table) => table.tableName));

  const concepts = [
    {
      _id: "High Value Customer",
      type: "BusinessConcept",
      attributes: {
        description: ["Commercial customers in the high-value segment used for retention analysis."],
        domain: ["Customer Experience"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Churn Risk",
      type: "BusinessConcept",
      attributes: {
        description: ["Risk of account churn measured through churn score facts."],
        domain: ["Risk"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Plan Migration",
      type: "BusinessConcept",
      attributes: {
        description: ["Customer movement from one telecom plan to another."],
        domain: ["Product"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Billing Dispute",
      type: "BusinessConcept",
      attributes: {
        description: ["Billing issue events such as disputes, credits, and invoice adjustments."],
        domain: ["Finance"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Network Usage",
      type: "BusinessConcept",
      attributes: {
        description: ["Service quality and consumption metrics by account."],
        domain: ["Network Operations"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Customer Support",
      type: "BusinessConcept",
      attributes: {
        description: ["Operational support case activity tied to customer incidents."],
        domain: ["Customer Experience"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Customer Experience",
      type: "Domain",
      attributes: { description: ["Customer-facing operational and commercial domains."] },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Risk",
      type: "Domain",
      attributes: { description: ["Enterprise risk analytics domain."] },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "churn_score",
      type: "Metric",
      attributes: {
        description: ["Periodic churn probability score by account."],
        sourceColumns: ["churn_scores.churn_score"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "dropped_call_rate",
      type: "Metric",
      attributes: {
        description: ["Network quality metric correlated with churn risk."],
        sourceColumns: ["usage_metrics.dropped_call_rate"]
      },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "CRM Data Office",
      type: "Owner",
      attributes: { team: ["CRM Data Office"] },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "PII",
      type: "PolicyClassification",
      attributes: { level: ["restricted"], description: ["Personally identifiable information."] },
      relationships: { target_ids: [], types: [], attributes: [] }
    },
    {
      _id: "Restricted",
      type: "PolicyClassification",
      attributes: { level: ["restricted"], description: ["Restricted data requiring elevated access."] },
      relationships: { target_ids: [], types: [], attributes: [] }
    }
  ];

  const link = (sourceId, targetId, type, attributes = {}) => {
    const entity = concepts.find((item) => item._id === sourceId);
    if (!entity) {
      return;
    }
    entity.relationships.target_ids.push(targetId);
    entity.relationships.types.push(type);
    entity.relationships.attributes.push(attributes);
  };

  link("High Value Customer", "customer_value_segments", "maps_to_table");
  link("High Value Customer", "customers", "maps_to_table");
  link("Churn Risk", "churn_scores", "maps_to_table");
  link("Plan Migration", "plan_migrations", "maps_to_table");
  link("Billing Dispute", "billing_events", "maps_to_table");
  link("Network Usage", "usage_metrics", "maps_to_table");
  link("Customer Support", "support_cases", "maps_to_table");
  link("Customer Experience", "customers", "contains_table");
  link("Customer Experience", "support_cases", "contains_table");
  link("Risk", "churn_scores", "contains_table");
  link("churn_score", "churn_scores.churn_score", "metric_on_column");
  link("dropped_call_rate", "usage_metrics.dropped_call_rate", "metric_on_column");
  link("CRM Data Office", "customers", "owns_table");
  link("PII", "customers.customer_name", "classifies_column");
  link("Restricted", "customers.customer_name", "classifies_column");

  return concepts.filter((entity) => {
    if (entity.type === "Table" && !tableNames.has(entity._id)) {
      return false;
    }
    return true;
  });
}

export const SUPPORTED_SAMPLE_PROMPTS = [
  "Which tables help analyze churn risk after plan migration?",
  "How do I join billing disputes to high-value customers?",
  "Which fields should I use to analyze network usage by customer segment?",
  "What data is needed to investigate support cases after a plan change?"
];

export const UNSUPPORTED_SAMPLE_PROMPTS = [
  "Show me customer credit card numbers.",
  "Predict churn for every customer now.",
  "Query snowflake_finance_mart.unregistered_orders."
];
