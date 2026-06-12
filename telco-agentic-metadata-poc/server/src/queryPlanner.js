import { resolveJoinPath } from "./graphTraversal.js";
import { validateQueryPlan } from "./planValidator.js";
import { generateQueryPlanWithGrove } from "./llm.js";

function enrichTables(selectedTables, allTables, evidencePrefix = "Retrieved from metadata catalog") {
  return selectedTables
    .map((entry) => {
      const tableName = typeof entry === "string" ? entry : entry.tableName;
      const catalogTable = allTables.find((table) => table.tableName === tableName);
      if (!catalogTable) {
        return null;
      }

      return {
        tableName: catalogTable.tableName,
        schemaName: catalogTable.schemaName,
        reason: typeof entry === "string" ? evidencePrefix : entry.reason ?? evidencePrefix,
        confidence: typeof entry === "object" ? Number(entry.confidence ?? entry.score ?? 0.5) : 0.5,
        evidence: typeof entry === "object" ? entry.evidence ?? [evidencePrefix] : [evidencePrefix],
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

function inferColumnsFromTables(tables, allTables) {
  const columns = [];
  for (const tableEntry of tables) {
    const table = allTables.find((item) => item.tableName === tableEntry.tableName);
    for (const field of table?.sampleFields ?? table?.primaryKeys ?? []) {
      columns.push({
        tableName: tableEntry.tableName,
        columnName: field,
        reason: "Column referenced in metadata sample fields or primary keys.",
        confidence: 0.55
      });
    }
  }
  return columns.slice(0, 12);
}

export function buildMetadataGroundedPlan({
  question,
  retrievedTables,
  retrievedEdges,
  graphEvidence,
  allTables,
  allEdges
}) {
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

  const selectedNames = uniqueTables.slice(0, 4).map((table) => table.tableName);
  const joinEdges =
    selectedNames.length > 1 ? resolveJoinPath(selectedNames, allEdges) : retrievedEdges.slice(0, 3);

  const plan = {
    intent: "Metadata-grounded plan from retrieved tables, relationships, and graph evidence",
    tables: uniqueTables.slice(0, 4),
    columns: inferColumnsFromTables(uniqueTables.slice(0, 4), allTables),
    joins: buildJoinObjects(joinEdges),
    filters: [],
    metrics: [],
    assumptions: [
      "Filters and metrics should be refined once business rules are confirmed against the warehouse."
    ],
    confidence: uniqueTables[0]?.confidence ?? 0.4,
    limitations: [],
    joinPath: selectedNames,
    consideredTables: retrievedTables.slice(0, 6).map((table) => table.tableName),
    graphEvidence: graphEvidence?.entities ?? []
  };

  return {
    ...plan,
    ...validateQueryPlan(plan, { question, tableCatalog: allTables, edgeCatalog: allEdges })
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
    queryExamples: graphEvidence?.examples ?? []
  };

  const grovePlan = await generateQueryPlanWithGrove({
    question,
    metadataContext,
    tableCatalog: allTables,
    edgeCatalog: allEdges
  });

  if (grovePlan) {
    return grovePlan;
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
