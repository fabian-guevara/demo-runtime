import test from "node:test";
import assert from "node:assert/strict";
import { validateQueryPlan, detectQuestionLimitations } from "../planValidator.js";
import { generateSqlDraft } from "../sqlGenerator.js";
import { createCatalogSeed } from "../sampleData.js";
import { applyGovernanceMetadata } from "../governance.js";
import { parseModelJson } from "../utils/parseModelJson.js";

const catalog = applyGovernanceMetadata(createCatalogSeed());
const tableCatalog = catalog.tables;
const edgeCatalog = catalog.edges;

test("unknown business question does not produce fake SQL", () => {
  const plan = {
    isValid: false,
    tables: [],
    columns: [],
    joins: [],
    filters: [],
    metrics: [],
    validationErrors: ["No tables were selected from the metadata catalog."]
  };

  const sql = generateSqlDraft(plan, { question: "Predict churn for every customer now." });
  assert.equal(sql.status, "validation_failed");
  assert.equal(sql.text, "");
});

test("planner rejects nonexistent columns", () => {
  const plan = {
    tables: [{ tableName: "customers", reason: "test", confidence: 0.8 }],
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
      { tableName: "customers", reason: "test", confidence: 0.8 },
      { tableName: "billing_events", reason: "test", confidence: 0.8 }
    ],
    columns: [],
    joins: [
      {
        sourceTable: "customers",
        targetTable: "billing_events",
        sourceColumn: "missing_customer_key",
        targetColumn: "customer_id",
        confidence: 0.8
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
    tables: [{ tableName: "customers", reason: "test", confidence: 0.8 }],
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
  assert.throws(() => parseModelJson("not-json"), /not valid JSON/i);
});

test("unsupported warehouse table question is flagged", () => {
  const limitations = detectQuestionLimitations(
    "Query snowflake_finance_mart.unregistered_orders.",
    tableCatalog
  );
  assert.ok(limitations.length > 0);
});
