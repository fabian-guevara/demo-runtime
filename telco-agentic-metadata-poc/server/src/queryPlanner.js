import env from "./config/env.js";
import { resolveJoinPath } from "./graphTraversal.js";
import { detectQuestionLimitations, validateQueryPlan } from "./planValidator.js";
import { generateQueryPlanWithGrove } from "./llm.js";

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length > 1);
}

function buildInvalidPlan(question, limitations, allTables, allEdges) {
  const plan = {
    intent: "Cannot answer from available metadata",
    tables: [],
    columns: [],
    joins: [],
    filters: [],
    metrics: [],
    assumptions: [],
    confidence: 0,
    limitations,
    graphEvidence: []
  };

  return {
    ...plan,
    ...validateQueryPlan(plan, { question, tableCatalog: allTables, edgeCatalog: allEdges }),
    planSource: "metadata"
  };
}

function enrichTables(selectedTables, allTables, evidencePrefix = "Retrieved from metadata catalog") {
  return selectedTables
    .map((entry) => {
      const tableName = typeof entry === "string" ? entry : entry.tableName;
      const catalogTable = allTables.find((table) => table.tableName === tableName);
      if (!catalogTable) {
        return null;
      }

      const retrievalScore = typeof entry === "object" ? Number(entry.score ?? 0) : 0;
      const confidence = Math.min(
        0.95,
        Math.max(
          0.35,
          typeof entry === "object" ? Number(entry.confidence ?? (retrievalScore / 10 || 0.5)) : 0.5
        )
      );

      return {
        tableName: catalogTable.tableName,
        schemaName: catalogTable.schemaName,
        reason: typeof entry === "object" ? entry.reason ?? evidencePrefix : evidencePrefix,
        confidence,
        evidence:
          typeof entry === "object"
            ? entry.evidence ?? [
                evidencePrefix,
                catalogTable.businessDescription,
                `Retrieval score ${retrievalScore || "n/a"}`
              ]
            : [evidencePrefix, catalogTable.businessDescription],
        rowCount: catalogTable.rowCount,
        primaryKeys: catalogTable.primaryKeys
      };
    })
    .filter(Boolean);
}

function buildJoinObjects(joinEdges) {
  return joinEdges.map((edge) => ({
    sourceTable: edge.sourceTable,
    targetTable: edge.targetTable,
    sourceColumn: edge.sourceColumn,
    targetColumn: edge.targetColumn,
    confidence: Number(edge.confidence ?? 0.8),
    evidence: edge.graphRag ? ["Validated graph path"] : ["Validated metadata edge"],
    description: edge.relationshipDescription ?? edge.description ?? ""
  }));
}

function columnsFromGraphEvidence(graphEvidence, allTables) {
  const columns = [];
  const seen = new Set();

  for (const entity of graphEvidence?.entities ?? []) {
    if (entity.type !== "Metric") {
      continue;
    }

    for (const ref of entity.attributes?.sourceColumns ?? []) {
      const [tableName, columnName] = String(ref).split(".");
      const table = allTables.find((item) => item.tableName === tableName);
      const column = table?.columns?.find((item) => item.name === columnName);
      if (!column) {
        continue;
      }

      const key = `${tableName}.${columnName}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      columns.push({
        tableName,
        columnName,
        reason: `Metric ${entity._id} is documented on this column in the knowledge graph.`,
        confidence: 0.82,
        evidence: [`Graph metric ${entity._id}`, ref]
      });
    }
  }

  return columns;
}

function columnsFromRetrievedMetadata(tables, allTables, question) {
  const questionTokens = new Set(tokenize(question));
  const columns = [];
  const seen = new Set();

  for (const tableEntry of tables) {
    const table = allTables.find((item) => item.tableName === tableEntry.tableName);
    if (!table) {
      continue;
    }

    for (const column of table.columns ?? []) {
      const columnTokens = tokenize(column.name);
      const matchesQuestion = columnTokens.some((token) => questionTokens.has(token));
      if (!matchesQuestion && !table.primaryKeys?.includes(column.name)) {
        continue;
      }

      const key = `${table.tableName}.${column.name}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      columns.push({
        tableName: table.tableName,
        columnName: column.name,
        reason: matchesQuestion
          ? "Column name overlaps with terms in the question and exists in metadata."
          : "Primary key column selected from metadata catalog.",
        confidence: matchesQuestion ? 0.72 : 0.65,
        evidence: [table.businessDescription, `${table.schemaName}.${table.tableName}.${column.name}`]
      });
    }
  }

  return columns;
}

function buildGraphEvidenceSummary(graphEvidence) {
  return (graphEvidence?.entities ?? []).map((entity) => ({
    id: entity._id ?? entity.id,
    type: entity.type,
    description: entity.attributes?.description?.[0] ?? entity.description ?? entity._id,
    evidence: entity.attributes?.sourceColumns ?? entity.attributes?.domain ?? []
  }));
}

export function buildMetadataGroundedPlan({
  question,
  retrievedTables,
  retrievedEdges,
  graphEvidence,
  allTables,
  allEdges
}) {
  const limitations = detectQuestionLimitations(question, allTables);
  if (limitations.length > 0) {
    return buildInvalidPlan(question, limitations, allTables, allEdges);
  }

  const rankedTables = enrichTables(
    [...retrievedTables, ...(graphEvidence?.tables ?? [])],
    allTables,
    "Ranked by metadata retrieval evidence"
  );

  const uniqueTables = [];
  const seen = new Set();
  for (const table of rankedTables) {
    if (seen.has(table.tableName)) {
      continue;
    }
    seen.add(table.tableName);
    uniqueTables.push(table);
  }

  if (uniqueTables.length === 0) {
    return buildInvalidPlan(
      question,
      ["No relevant tables were retrieved from the metadata catalog."],
      allTables,
      allEdges
    );
  }

  const selectedTables = uniqueTables.slice(0, 4);
  const selectedNames = selectedTables.map((table) => table.tableName);
  const joinPath = selectedNames.length > 1 ? resolveJoinPath(selectedNames, allEdges) : retrievedEdges.slice(0, 3);

  const graphColumns = columnsFromGraphEvidence(graphEvidence, allTables);
  const metadataColumns = columnsFromRetrievedMetadata(selectedTables, allTables, question);
  const columns = [...graphColumns, ...metadataColumns]
    .filter((column, index, list) => list.findIndex((item) => `${item.tableName}.${item.columnName}` === `${column.tableName}.${column.columnName}`) === index)
    .slice(0, 12);

  const plan = {
    intent: "Metadata-grounded plan from retrieved tables, relationships, and graph evidence",
    tables: selectedTables,
    columns,
    joins: buildJoinObjects(joinPath),
    filters: [],
    metrics: graphColumns.map((column) => ({
      name: column.columnName,
      expression: `${column.tableName}.${column.columnName}`,
      sourceColumns: [`${column.tableName}.${column.columnName}`],
      confidence: column.confidence
    })),
    assumptions: columns.length
      ? ["Selected columns come only from retrieved metadata and graph evidence."]
      : ["No column overlap was found between the question and retrieved metadata columns."],
    confidence: selectedTables[0]?.confidence ?? 0.4,
    limitations: [],
    graphEvidence: buildGraphEvidenceSummary(graphEvidence)
  };

  return {
    ...plan,
    ...validateQueryPlan(plan, { question, tableCatalog: allTables, edgeCatalog: allEdges }),
    planSource: "metadata"
  };
}

export async function buildQueryPlan({
  question,
  retrievedTables,
  retrievedEdges,
  graphEvidence,
  allTables,
  allEdges
}) {
  const limitations = detectQuestionLimitations(question, allTables);
  if (limitations.length > 0) {
    return buildInvalidPlan(question, limitations, allTables, allEdges);
  }

  const metadataContext = {
    retrievedTables: retrievedTables.map((table) => ({
      tableName: table.tableName,
      schemaName: table.schemaName,
      businessDescription: table.businessDescription,
      columns: table.columns?.map((column) => ({
        name: column.name,
        type: column.type,
        classification: column.classification,
        containsPii: column.containsPii
      })),
      tags: table.tags,
      sampleFields: table.sampleFields,
      score: table.score
    })),
    retrievedEdges: retrievedEdges.map((edge) => ({
      sourceTable: edge.sourceTable,
      targetTable: edge.targetTable,
      sourceColumn: edge.sourceColumn,
      targetColumn: edge.targetColumn,
      confidence: edge.confidence,
      relationshipDescription: edge.relationshipDescription
    })),
    graphEvidence: graphEvidence?.entities ?? [],
    graphExamples: graphEvidence?.examples ?? []
  };

  if (env.requireLlm) {
    const grovePlan = await generateQueryPlanWithGrove({
      question,
      metadataContext,
      tableCatalog: allTables,
      edgeCatalog: allEdges
    });

    if (grovePlan) {
      return {
        ...grovePlan,
        graphEvidence: buildGraphEvidenceSummary(graphEvidence),
        planSource: "grove"
      };
    }
  }

  return buildMetadataGroundedPlan({
    question,
    retrievedTables,
    retrievedEdges,
    graphEvidence,
    allTables,
    allEdges
  });
}
