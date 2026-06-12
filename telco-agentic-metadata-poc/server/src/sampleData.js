export function createCatalogSeed() {
  const tables = [
    {
      nodeType: "table",
      tableName: "customers",
      schemaName: "crm",
      businessDescription:
        "Customer master table containing account profile, segment, region, lifecycle status, and commercial ownership.",
      columns: [
        { name: "customer_id", type: "string", semanticRole: "primary_key" },
        { name: "customer_name", type: "string" },
        { name: "segment", type: "string" },
        { name: "region", type: "string" },
        { name: "account_id", type: "string", semanticRole: "foreign_key" },
        { name: "status", type: "string" }
      ],
      primaryKeys: ["customer_id"],
      rowCount: 12000000,
      scannedTimestamp: "2026-05-20T09:00:00.000Z",
      freshness: "daily",
      sourceSystem: "Redshift",
      tags: ["customer", "crm", "account"],
      sampleQuestions: [
        "Which customers are high value?",
        "How many enterprise customers are active?"
      ],
      sampleFields: ["customer_id", "customer_name", "segment", "region", "account_id"],
      sampleData: [
        {
          customer_id: "cust_1001",
          customer_name: "Northwind Industrial",
          segment: "Enterprise",
          region: "South"
        },
        {
          customer_id: "cust_1002",
          customer_name: "Everline Logistics",
          segment: "Mid-Market",
          region: "West"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "customer_value_segments",
      schemaName: "crm",
      businessDescription:
        "Maps each customer to the current commercial value segment, lifetime value band, and profitability tier.",
      columns: [
        { name: "customer_id", type: "string", semanticRole: "primary_key" },
        { name: "segment", type: "string" },
        { name: "lifetime_value", type: "decimal" },
        { name: "tier_reason", type: "string" },
        { name: "effective_date", type: "date" }
      ],
      primaryKeys: ["customer_id"],
      rowCount: 12000000,
      scannedTimestamp: "2026-05-20T09:15:00.000Z",
      freshness: "daily",
      sourceSystem: "Databricks SQL Warehouse",
      tags: ["customer", "value", "segmentation", "commercial"],
      sampleQuestions: [
        "Which customers are high value?",
        "How many strategic accounts are platinum tier?"
      ],
      sampleFields: ["customer_id", "segment", "lifetime_value"],
      sampleData: [
        {
          customer_id: "cust_1001",
          segment: "High Value",
          lifetime_value: 982500
        },
        {
          customer_id: "cust_1002",
          segment: "Growth",
          lifetime_value: 225400
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "plan_migrations",
      schemaName: "network",
      businessDescription:
        "Tracks customer migrations from one telecom plan to another, including migration date, migration driver, and order channel.",
      columns: [
        { name: "migration_id", type: "string", semanticRole: "primary_key" },
        { name: "customer_id", type: "string", semanticRole: "foreign_key" },
        { name: "old_plan_id", type: "string", semanticRole: "foreign_key" },
        { name: "new_plan_id", type: "string", semanticRole: "foreign_key" },
        { name: "migration_date", type: "date" },
        { name: "migration_reason", type: "string" }
      ],
      primaryKeys: ["migration_id"],
      rowCount: 1860000,
      scannedTimestamp: "2026-05-19T18:30:00.000Z",
      freshness: "hourly",
      sourceSystem: "Redshift",
      tags: ["plan", "migration", "network", "orders"],
      sampleQuestions: [
        "Which customers migrated plans in the last 30 days?",
        "Which plan changes triggered churn?"
      ],
      sampleFields: ["customer_id", "old_plan_id", "new_plan_id", "migration_date"],
      sampleData: [
        {
          migration_id: "mig_7001",
          customer_id: "cust_1001",
          old_plan_id: "plan_legacy_a",
          new_plan_id: "plan_5g_pro",
          migration_date: "2026-05-08"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "billing_events",
      schemaName: "billing",
      businessDescription:
        "Billing event fact table capturing disputes, credits, invoice adjustments, and bill shock events by customer and account.",
      columns: [
        { name: "billing_event_id", type: "string", semanticRole: "primary_key" },
        { name: "customer_id", type: "string", semanticRole: "foreign_key" },
        { name: "account_id", type: "string", semanticRole: "foreign_key" },
        { name: "event_type", type: "string" },
        { name: "event_date", type: "date" },
        { name: "amount_impact", type: "decimal" },
        { name: "severity", type: "string" }
      ],
      primaryKeys: ["billing_event_id"],
      rowCount: 34200000,
      scannedTimestamp: "2026-05-20T10:10:00.000Z",
      freshness: "hourly",
      sourceSystem: "Databricks SQL Warehouse",
      tags: ["billing", "invoice", "dispute", "finance"],
      sampleQuestions: [
        "Which customers had billing issues recently?",
        "How many billing disputes happened after a plan migration?"
      ],
      sampleFields: ["customer_id", "event_type", "event_date", "severity"],
      sampleData: [
        {
          billing_event_id: "bill_4101",
          customer_id: "cust_1001",
          event_type: "Billing Issue",
          event_date: "2026-05-16",
          severity: "High"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "support_cases",
      schemaName: "support",
      businessDescription:
        "Operational support case table with case reason, severity, resolution status, and escalation path for customer-facing incidents.",
      columns: [
        { name: "case_id", type: "string", semanticRole: "primary_key" },
        { name: "customer_id", type: "string", semanticRole: "foreign_key" },
        { name: "opened_at", type: "timestamp" },
        { name: "case_category", type: "string" },
        { name: "status", type: "string" },
        { name: "severity", type: "string" }
      ],
      primaryKeys: ["case_id"],
      rowCount: 9100000,
      scannedTimestamp: "2026-05-20T08:45:00.000Z",
      freshness: "hourly",
      sourceSystem: "ServiceNow export",
      tags: ["support", "case", "service", "incident"],
      sampleQuestions: [
        "Which customers opened support cases after a billing issue?",
        "Show the join path between billing events and support cases."
      ],
      sampleFields: ["customer_id", "case_category", "status"],
      sampleData: [
        {
          case_id: "case_8301",
          customer_id: "cust_1001",
          case_category: "Invoice dispute follow-up",
          status: "Open"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "plans",
      schemaName: "network",
      businessDescription:
        "Reference table of telecom plans with commercial family, network tier, and migration-friendly product attributes.",
      columns: [
        { name: "plan_id", type: "string", semanticRole: "primary_key" },
        { name: "plan_name", type: "string" },
        { name: "plan_family", type: "string" },
        { name: "network_tier", type: "string" },
        { name: "monthly_price", type: "decimal" }
      ],
      primaryKeys: ["plan_id"],
      rowCount: 480,
      scannedTimestamp: "2026-05-18T12:00:00.000Z",
      freshness: "daily",
      sourceSystem: "Product catalog",
      tags: ["plan", "product", "reference"],
      sampleQuestions: [
        "What plan family did customers migrate into?",
        "Which plan IDs belong to 5G Pro?"
      ],
      sampleFields: ["plan_id", "plan_name", "plan_family"],
      sampleData: [
        {
          plan_id: "plan_5g_pro",
          plan_name: "5G Pro Unlimited",
          plan_family: "5G Pro"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "accounts",
      schemaName: "crm",
      businessDescription:
        "Business account dimension table for enterprise and mid-market accounts with contract identifiers and ownership data.",
      columns: [
        { name: "account_id", type: "string", semanticRole: "primary_key" },
        { name: "account_name", type: "string" },
        { name: "customer_id", type: "string", semanticRole: "foreign_key" },
        { name: "segment", type: "string" },
        { name: "contract_id", type: "string", semanticRole: "foreign_key" },
        { name: "region", type: "string" }
      ],
      primaryKeys: ["account_id"],
      rowCount: 2800000,
      scannedTimestamp: "2026-05-20T07:40:00.000Z",
      freshness: "daily",
      sourceSystem: "Redshift",
      tags: ["account", "crm", "contract", "enterprise"],
      sampleQuestions: [
        "Which enterprise accounts had the highest churn risk last quarter?",
        "Which accounts renew this quarter?"
      ],
      sampleFields: ["account_id", "account_name", "segment", "contract_id"],
      sampleData: [
        {
          account_id: "acct_5001",
          account_name: "Northwind Industrial Holdings",
          segment: "Enterprise",
          contract_id: "contract_1501"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "churn_scores",
      schemaName: "risk",
      businessDescription:
        "Periodic churn-scoring fact table by account, including model score, score band, and top explanatory risk drivers.",
      columns: [
        { name: "score_id", type: "string", semanticRole: "primary_key" },
        { name: "account_id", type: "string", semanticRole: "foreign_key" },
        { name: "score_date", type: "date" },
        { name: "churn_score", type: "decimal" },
        { name: "risk_band", type: "string" },
        { name: "top_driver", type: "string" }
      ],
      primaryKeys: ["score_id"],
      rowCount: 22400000,
      scannedTimestamp: "2026-05-20T06:55:00.000Z",
      freshness: "daily",
      sourceSystem: "Databricks Feature Store",
      tags: ["churn", "risk", "account", "score"],
      sampleQuestions: [
        "Which accounts have the highest churn risk?",
        "What were the top churn drivers last quarter?"
      ],
      sampleFields: ["account_id", "score_date", "churn_score", "risk_band"],
      sampleData: [
        {
          score_id: "score_9901",
          account_id: "acct_5001",
          score_date: "2026-03-31",
          churn_score: 0.92,
          risk_band: "Critical"
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "usage_metrics",
      schemaName: "network",
      businessDescription:
        "Network usage and service quality metrics by account, including dropped-call rates, latency, and data consumption trends.",
      columns: [
        { name: "usage_metric_id", type: "string", semanticRole: "primary_key" },
        { name: "account_id", type: "string", semanticRole: "foreign_key" },
        { name: "metric_date", type: "date" },
        { name: "avg_latency_ms", type: "integer" },
        { name: "dropped_call_rate", type: "decimal" },
        { name: "data_usage_tb", type: "decimal" }
      ],
      primaryKeys: ["usage_metric_id"],
      rowCount: 51200000,
      scannedTimestamp: "2026-05-20T10:45:00.000Z",
      freshness: "daily",
      sourceSystem: "Network telemetry lakehouse",
      tags: ["usage", "network", "quality", "telemetry"],
      sampleQuestions: [
        "Which accounts showed degraded service before churn risk spiked?",
        "What usage metrics correlate with billing issues?"
      ],
      sampleFields: ["account_id", "metric_date", "avg_latency_ms", "dropped_call_rate"],
      sampleData: [
        {
          usage_metric_id: "use_7301",
          account_id: "acct_5001",
          metric_date: "2026-03-18",
          avg_latency_ms: 63,
          dropped_call_rate: 0.032
        }
      ]
    },
    {
      nodeType: "table",
      tableName: "contract_renewals",
      schemaName: "finance",
      businessDescription:
        "Contract renewal schedule table with renewal windows, committed revenue, and renewal owner assignments.",
      columns: [
        { name: "contract_id", type: "string", semanticRole: "primary_key" },
        { name: "renewal_date", type: "date" },
        { name: "committed_arr", type: "decimal" },
        { name: "renewal_status", type: "string" },
        { name: "owner_name", type: "string" }
      ],
      primaryKeys: ["contract_id"],
      rowCount: 1450000,
      scannedTimestamp: "2026-05-19T23:00:00.000Z",
      freshness: "daily",
      sourceSystem: "Finance mart",
      tags: ["renewal", "contract", "finance", "arr"],
      sampleQuestions: [
        "Which accounts renew this quarter?",
        "What churn-risk accounts are close to renewal?"
      ],
      sampleFields: ["contract_id", "renewal_date", "committed_arr", "renewal_status"],
      sampleData: [
        {
          contract_id: "contract_1501",
          renewal_date: "2026-06-30",
          committed_arr: 4200000,
          renewal_status: "At Risk"
        }
      ]
    }
  ];

  const edges = [
    {
      edgeType: "join",
      sourceTable: "customers",
      targetTable: "customer_value_segments",
      sourceColumn: "customer_id",
      targetColumn: "customer_id",
      confidence: 0.99,
      relationshipDescription: "Maps a customer to the current commercial value segment.",
      cardinality: "one_to_one",
      freshness: "daily"
    },
    {
      edgeType: "join",
      sourceTable: "customers",
      targetTable: "plan_migrations",
      sourceColumn: "customer_id",
      targetColumn: "customer_id",
      confidence: 0.98,
      relationshipDescription: "Connects each customer to recent plan migration activity.",
      cardinality: "one_to_many",
      freshness: "hourly"
    },
    {
      edgeType: "join",
      sourceTable: "customers",
      targetTable: "billing_events",
      sourceColumn: "customer_id",
      targetColumn: "customer_id",
      confidence: 0.98,
      relationshipDescription: "Connects customers to billing disputes, credits, and invoice events.",
      cardinality: "one_to_many",
      freshness: "hourly"
    },
    {
      edgeType: "join",
      sourceTable: "customers",
      targetTable: "support_cases",
      sourceColumn: "customer_id",
      targetColumn: "customer_id",
      confidence: 0.96,
      relationshipDescription: "Connects customers to support case activity.",
      cardinality: "one_to_many",
      freshness: "hourly"
    },
    {
      edgeType: "join",
      sourceTable: "plan_migrations",
      targetTable: "plans",
      sourceColumn: "old_plan_id",
      targetColumn: "plan_id",
      confidence: 0.95,
      relationshipDescription: "Looks up the plan customers migrated away from.",
      cardinality: "many_to_one",
      freshness: "daily"
    },
    {
      edgeType: "join",
      sourceTable: "plan_migrations",
      targetTable: "plans",
      sourceColumn: "new_plan_id",
      targetColumn: "plan_id",
      confidence: 0.95,
      relationshipDescription: "Looks up the plan customers migrated into.",
      cardinality: "many_to_one",
      freshness: "daily"
    },
    {
      edgeType: "join",
      sourceTable: "accounts",
      targetTable: "churn_scores",
      sourceColumn: "account_id",
      targetColumn: "account_id",
      confidence: 0.99,
      relationshipDescription: "Connects each business account to periodic churn scores.",
      cardinality: "one_to_many",
      freshness: "daily"
    },
    {
      edgeType: "join",
      sourceTable: "accounts",
      targetTable: "usage_metrics",
      sourceColumn: "account_id",
      targetColumn: "account_id",
      confidence: 0.97,
      relationshipDescription: "Connects business accounts to service-usage telemetry.",
      cardinality: "one_to_many",
      freshness: "daily"
    },
    {
      edgeType: "join",
      sourceTable: "accounts",
      targetTable: "contract_renewals",
      sourceColumn: "contract_id",
      targetColumn: "contract_id",
      confidence: 0.99,
      relationshipDescription: "Connects a business account to its active renewal contract.",
      cardinality: "many_to_one",
      freshness: "daily"
    }
  ];

  const queryExamples = [
    {
      question: "How many high-value customers had billing issues after a plan migration in the last 30 days?",
      expectedIntent: "billing_issue_after_plan_migration",
      expectedTables: [
        "customers",
        "customer_value_segments",
        "plan_migrations",
        "billing_events"
      ]
    },
    {
      question: "Which enterprise accounts had the highest churn risk last quarter?",
      expectedIntent: "highest_churn_risk_last_quarter",
      expectedTables: ["accounts", "churn_scores"]
    },
    {
      question: "Which tables should I use to analyze billing issues after plan migration?",
      expectedIntent: "table_recommendation",
      expectedTables: ["customers", "plan_migrations", "billing_events"]
    },
    {
      question: "Show me the join path between customers, billing events, and support cases.",
      expectedIntent: "join_path_lookup",
      expectedTables: ["customers", "billing_events", "support_cases"]
    }
  ];

  return { tables, edges, queryExamples };
}
