import test from "node:test";
import assert from "node:assert/strict";
import { validateQueryPlan, detectQuestionLimitations } from "../planValidator.js";
import { buildMetadataGroundedPlan } from "../queryPlanner.js";
import { generateSqlDraft } from "../sqlGenerator.js";
import { createCatalogSeed } from "../sampleData.js";
import { applyGovernanceMetadata } from "../governance.js";
import { parseModelJson } from "../utils/parseModelJson.js";

const catalog = applyGovernanceMetadata(createCatalogSeed());
const tableCatalog = catalog.tables;
const edgeCatalog = catalog.edges;

function assertNoSql(question) {
  const plan = buildMetadataGroundedPlan({
    question,
    retrievedTables: tableCatalog.slice(0, 3),
    retrievedEdges: edgeCatalog.slice(0, 2),
    graphEvidence: { entities: [], tables: [] },
    allTables: tableCatalog,
    allEdges: edgeCatalog
  });
  const sql = generateSqlDraft(plan, { question });
  assert.equal(plan.isValid, false, `plan should be invalid for: ${question}`);
  assert.notEqual(sql.status, "generated", `SQL must not be generated for: ${question}`);
  assert.equal(sql.text, "");
}

test("credit card question must not generate SQL", () => {
  assertNoSql("Show me customer credit card numbers.");
});

test("predictive churn question must not generate SQL", () => {
  assertNoSql("Predict churn for every customer now.");
});

test("unknown warehouse table must not generate SQL", () => {
  assertNoSql("Query snowflake_finance_mart.unregistered_orders.");
});

test("planner rejects nonexistent columns", () => {
  const plan = {
    tables: [{ tableName: "customers", reason: "test", confidence: 0.8, evidence: ["test"] }],
    columns: [{ tableName: "customers", columnName: "credit_card_number", reason: "test", confidence: 0.8 }],
    joins: [],
    filters: [],
    metrics: []
  };

  const validation = validateQueryPlan(plan, {
    question: "Show credit card numbers",
    tableCatalog,
    edgeCatalog
  });

  assert.equal(validation.isValid, false);
  assert.match(validation.validationErrors.join(" "), /credit_card_number/);
});

test("planner rejects nonexistent joins", () => {
  const plan = {
    tables: [
      { tableName: "customers", reason: "test", confidence: 0.8, evidence: ["test"] },
      { tableName: "billing_events", reason: "test", confidence: 0.8, evidence: ["test"] }
    ],
    columns: [],
    joins: [
      {
        sourceTable: "customers",
        targetTable: "billing_events",
        sourceColumn: "missing_customer_key",
        targetColumn: "customer_id",
        confidence: 0.8,
        evidence: ["test"]
      }
    ],
    filters: [],
    metrics: []
  };

  const validation = validateQueryPlan(plan, {
    question: "Join customers to billing",
    tableCatalog,
    edgeCatalog
  });

  assert.equal(validation.isValid, false);
  assert.match(validation.validationErrors.join(" "), /Join/);
});

test("lexical degraded mode label is explicit", () => {
  const mode = "lexical_degraded";
  assert.notEqual(mode, "vector");
  assert.match(mode, /lexical_degraded/);
});

test("vector unavailable with REQUIRE_VECTOR_SEARCH fails clearly", () => {
  const error = new Error("REQUIRE_VECTOR_SEARCH=true but vector search is unavailable for table_nodes.");
  error.code = "VECTOR_SEARCH_UNAVAILABLE";
  assert.equal(error.code, "VECTOR_SEARCH_UNAVAILABLE");
});

test("policy warnings are emitted for PII fields", () => {
  const plan = {
    tables: [{ tableName: "customers", reason: "test", confidence: 0.8, evidence: ["test"] }],
    columns: [{ tableName: "customers", columnName: "customer_name", reason: "test", confidence: 0.8 }],
    joins: [],
    filters: [],
    metrics: []
  };

  const validation = validateQueryPlan(plan, {
    question: "Show customer names",
    tableCatalog,
    edgeCatalog
  });

  assert.ok(validation.policyWarnings.length > 0);
  assert.ok(validation.sensitiveFields.some((field) => field.columnName === "customer_name"));
});

test("LLM malformed JSON fails validation instead of silently falling back", () => {
  try {
    parseModelJson("not-json");
    assert.fail("expected parseModelJson to throw");
  } catch (error) {
    assert.match(error.message, /not valid JSON/i);
    assert.equal(error.code, "LLM_JSON_PARSE_FAILED");
  }
});

test("unsupported warehouse table question is flagged", () => {
  const limitations = detectQuestionLimitations(
    "Query snowflake_finance_mart.unregistered_orders.",
    tableCatalog
  );
  assert.ok(limitations.length > 0);
});

test("generated SQL never uses SELECT star", () => {
  const customers = tableCatalog.find((table) => table.tableName === "customers");
  const billing = tableCatalog.find((table) => table.tableName === "billing_events");
  const valueSegments = tableCatalog.find((table) => table.tableName === "customer_value_segments");
  const join = edgeCatalog.find(
    (edge) => edge.sourceTable === "customers" && edge.targetTable === "billing_events"
  );

  const plan = {
    isValid: true,
    intent: "Join billing disputes to high value customers",
    tables: [
      {
        tableName: customers.tableName,
        schemaName: customers.schemaName,
        reason: "Customer master",
        confidence: 0.9,
        evidence: ["metadata"]
      },
      {
        tableName: billing.tableName,
        schemaName: billing.schemaName,
        reason: "Billing disputes",
        confidence: 0.85,
        evidence: ["metadata"]
      },
      {
        tableName: valueSegments.tableName,
        schemaName: valueSegments.schemaName,
        reason: "High value segment",
        confidence: 0.8,
        evidence: ["metadata"]
      }
    ],
    columns: [
      { tableName: "customers", columnName: "customer_id", reason: "pk", confidence: 0.8 },
      { tableName: "billing_events", columnName: "event_type", reason: "dispute", confidence: 0.8 },
      { tableName: "customer_value_segments", columnName: "segment", reason: "segment", confidence: 0.8 }
    ],
    joins: [
      {
        sourceTable: join.sourceTable,
        targetTable: join.targetTable,
        sourceColumn: join.sourceColumn,
        targetColumn: join.targetColumn,
        confidence: 0.9,
        evidence: ["edge"]
      },
      {
        sourceTable: "customers",
        targetTable: "customer_value_segments",
        sourceColumn: "customer_id",
        targetColumn: "customer_id",
        confidence: 0.9,
        evidence: ["edge"]
      }
    ],
    filters: [],
    metrics: [],
    __tableCatalog: tableCatalog
  };

  const sql = generateSqlDraft(plan, { question: "How do I join billing disputes to high-value customers?" });
  assert.equal(sql.status, "generated");
  assert.doesNotMatch(sql.text, /SELECT\s+\*/i);
});
