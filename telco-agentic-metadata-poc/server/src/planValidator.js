import { collectPolicyWarnings } from "./governance.js";

const BLOCKED_COLUMN_PATTERNS = [
  /credit\s*card/i,
  /card\s*number/i,
  /ssn/i,
  /social\s*security/i,
  /password/i
];

const OUT_OF_SCOPE_PATTERNS = [
  /predict\s+churn\s+for\s+every/i,
  /score\s+every\s+customer/i,
  /run\s+this\s+in\s+production/i,
  /certified\s+sql/i
];

function edgeKey(edge) {
  return `${edge.sourceTable}|${edge.sourceColumn}|${edge.targetTable}|${edge.targetColumn}`;
}

function reverseEdgeKey(edge) {
  return `${edge.targetTable}|${edge.targetColumn}|${edge.sourceTable}|${edge.sourceColumn}`;
}

function buildEdgeIndex(edgeCatalog) {
  const allowed = new Set();
  for (const edge of edgeCatalog) {
    allowed.add(edgeKey(edge));
    allowed.add(reverseEdgeKey(edge));
  }
  return allowed;
}

function findColumn(table, columnName) {
  return table?.columns?.find((column) => column.name === columnName);
}

export function detectQuestionLimitations(question, tableCatalog) {
  const limitations = [];

  for (const pattern of BLOCKED_COLUMN_PATTERNS) {
    if (pattern.test(question)) {
      limitations.push(
        "The requested field is not present in the loaded metadata catalog and cannot be queried safely."
      );
    }
  }

  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(question)) {
      limitations.push(
        "This demo plans metadata-grounded SQL drafts only; it does not execute predictive models or production-certified warehouse queries."
      );
    }
  }

  const catalogTables = new Set(tableCatalog.map((table) => table.tableName));
  const mentionedUnknownTables = [...question.matchAll(/\b([a-z][a-z0-9_]{2,})\b/gi)]
    .map((match) => match[1].toLowerCase())
    .filter(
      (token) =>
        token.endsWith("_mart") ||
        token.endsWith("_warehouse") ||
        token.includes("snowflake") ||
        token.includes("databricks")
    )
    .filter((token) => !catalogTables.has(token));

  if (mentionedUnknownTables.length > 0) {
    limitations.push(
      `Referenced warehouse objects are not in the metadata catalog: ${[...new Set(mentionedUnknownTables)].join(", ")}.`
    );
  }

  return [...new Set(limitations)];
}

export function validateQueryPlan(plan, { question, tableCatalog, edgeCatalog }) {
  const tableMap = new Map(tableCatalog.map((table) => [table.tableName, table]));
  const allowedEdges = buildEdgeIndex(edgeCatalog);
  const validationErrors = [];
  const validationWarnings = [];
  const limitations = detectQuestionLimitations(question, tableCatalog);

  if (!plan?.tables?.length) {
    validationErrors.push("No tables were selected from the metadata catalog.");
  }

  for (const tableEntry of plan.tables ?? []) {
    const table = tableMap.get(tableEntry.tableName);
    if (!table) {
      validationErrors.push(`Unknown table referenced in plan: ${tableEntry.tableName}`);
      continue;
    }

    if (typeof tableEntry.confidence !== "number") {
      validationWarnings.push(`Missing confidence for table ${tableEntry.tableName}.`);
    }

    if (!tableEntry.reason?.trim()) {
      validationWarnings.push(`Missing evidence reason for table ${tableEntry.tableName}.`);
    }
  }

  for (const columnEntry of plan.columns ?? []) {
    const table = tableMap.get(columnEntry.tableName);
    if (!table) {
      validationErrors.push(`Unknown table in column selection: ${columnEntry.tableName}`);
      continue;
    }

    if (!findColumn(table, columnEntry.columnName)) {
      validationErrors.push(
        `Column ${columnEntry.tableName}.${columnEntry.columnName} does not exist in metadata.`
      );
    }
  }

  for (const join of plan.joins ?? []) {
    const sourceTable = tableMap.get(join.sourceTable);
    const targetTable = tableMap.get(join.targetTable);

    if (!sourceTable || !targetTable) {
      validationErrors.push(
        `Join references unknown tables: ${join.sourceTable} -> ${join.targetTable}`
      );
      continue;
    }

    if (!findColumn(sourceTable, join.sourceColumn)) {
      validationErrors.push(`Join source column missing: ${join.sourceTable}.${join.sourceColumn}`);
    }

    if (!findColumn(targetTable, join.targetColumn)) {
      validationErrors.push(`Join target column missing: ${join.targetTable}.${join.targetColumn}`);
    }

    if (!allowedEdges.has(edgeKey(join)) && !allowedEdges.has(reverseEdgeKey(join))) {
      validationErrors.push(
        `Join path not present in metadata edges: ${join.sourceTable}.${join.sourceColumn} -> ${join.targetTable}.${join.targetColumn}`
      );
    }
  }

  for (const metric of plan.metrics ?? []) {
    const referencedColumns = metric.sourceColumns ?? [];
    if (referencedColumns.length === 0) {
      validationWarnings.push(`Metric ${metric.name ?? metric.expression} has no documented source columns.`);
    }

    for (const ref of referencedColumns) {
      const [tableName, columnName] = String(ref).split(".");
      const table = tableMap.get(tableName);
      if (!table || !findColumn(table, columnName)) {
        validationErrors.push(`Metric references unknown column: ${ref}`);
      }
    }
  }

  if (limitations.length > 0) {
    validationErrors.push(...limitations);
  }

  const { policyWarnings, sensitiveFields } = collectPolicyWarnings(plan, tableCatalog);

  return {
    isValid: validationErrors.length === 0,
    validationErrors,
    validationWarnings,
    policyWarnings,
    sensitiveFields,
    limitations
  };
}
