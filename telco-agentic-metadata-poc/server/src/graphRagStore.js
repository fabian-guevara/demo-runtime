import { trackedRuntimeAction } from "../../.demo/runtime-tracker.js";
import { callGroveForJson, groveConfigured } from "./llm.js";

export const GRAPH_COLLECTION = "metadata_knowledge_graph";
export const ALLOWED_ENTITY_TYPES = ["Table", "BusinessConcept", "Domain"];
export const ALLOWED_RELATIONSHIP_TYPES = ["joins_to", "belongs_to", "references", "related_to"];

function normalize(text) {
  return String(text).toLowerCase();
}

function tableMentionedInQuestion(question, tableName) {
  const normalizedQuestion = normalize(question);
  const spacedName = tableName.replaceAll("_", " ");
  return normalizedQuestion.includes(tableName) || normalizedQuestion.includes(spacedName);
}

export function buildTableEntity(table) {
  return {
    _id: table.tableName,
    type: "Table",
    attributes: {
      schema: [table.schemaName],
      description: [table.businessDescription],
      primaryKeys: table.primaryKeys ?? [],
      tags: table.tags ?? [],
      sourceSystem: [table.sourceSystem],
      freshness: [table.freshness]
    },
    relationships: {
      target_ids: [],
      types: [],
      attributes: []
    }
  };
}

export function appendRelationship(entity, targetId, type, attributes = {}) {
  entity.relationships.target_ids.push(targetId);
  entity.relationships.types.push(type);
  entity.relationships.attributes.push(attributes);
}

export async function seedKnowledgeGraph(db, tables, edges) {
  const collection = db.collection(GRAPH_COLLECTION);
  const entityMap = new Map();

  for (const table of tables) {
    entityMap.set(table.tableName, buildTableEntity(table));
  }

  for (const edge of edges) {
    const source = entityMap.get(edge.sourceTable);
    const target = entityMap.get(edge.targetTable);

    if (source) {
      appendRelationship(source, edge.targetTable, "joins_to", {
        sourceColumn: [edge.sourceColumn],
        targetColumn: [edge.targetColumn],
        description: [edge.relationshipDescription ?? ""],
        confidence: [String(edge.confidence ?? "")]
      });
    }

    if (target) {
      appendRelationship(target, edge.sourceTable, "joins_to", {
        sourceColumn: [edge.targetColumn],
        targetColumn: [edge.sourceColumn],
        description: [edge.relationshipDescription ?? ""],
        confidence: [String(edge.confidence ?? "")]
      });
    }
  }

  await collection.deleteMany({});
  const entities = [...entityMap.values()];

  if (entities.length > 0) {
    await collection.insertMany(entities);
  }

  await collection.createIndex({ type: 1 });

  return {
    entityCount: entities.length,
    relationshipCount: edges.length
  };
}

export async function relatedEntities(db, startingEntities, maxDepth = 3) {
  const startingIds = [...new Set(startingEntities.filter(Boolean))];

  if (startingIds.length === 0) {
    return [];
  }

  const pipeline = [
    { $match: { _id: { $in: startingIds } } },
    {
      $graphLookup: {
        from: GRAPH_COLLECTION,
        startWith: "$relationships.target_ids",
        connectFromField: "relationships.target_ids",
        connectToField: "_id",
        as: "connections",
        maxDepth,
        depthField: "depth"
      }
    },
    {
      $project: {
        _id: 0,
        original: {
          _id: "$_id",
          type: "$type",
          attributes: "$attributes",
          relationships: "$relationships"
        },
        connections: 1
      }
    },
    {
      $project: {
        combined: {
          $concatArrays: [["$original"], "$connections"]
        }
      }
    },
    { $unwind: "$combined" },
    {
      $group: {
        _id: "$combined._id",
        entity: { $first: "$combined" }
      }
    },
    { $replaceRoot: { newRoot: "$entity" } }
  ];

  return trackedRuntimeAction({
    name: "GraphRAG $graphLookup traversal",
    toolName: "graphLookup",
    dbName: db.databaseName,
    collectionName: GRAPH_COLLECTION,
    operation: "aggregate",
    query: pipeline,
    metadata: {
      startingEntities: startingIds,
      maxDepth
    },
    run: async () => db.collection(GRAPH_COLLECTION).aggregate(pipeline).toArray()
  });
}

export function extractEntityNamesLexical(question, tables, seedTables = []) {
  const names = new Set();

  for (const table of tables) {
    if (tableMentionedInQuestion(question, table.tableName)) {
      names.add(table.tableName);
    }
  }

  for (const table of seedTables) {
    if (table?.tableName) {
      names.add(table.tableName);
    }
  }

  if (names.size === 0 && seedTables.length > 0) {
    for (const table of seedTables.slice(0, 3)) {
      names.add(table.tableName);
    }
  }

  return [...names];
}

export async function extractEntityNames(question, tables, seedTables = []) {
  const lexicalNames = extractEntityNamesLexical(question, tables, seedTables);

  if (!groveConfigured()) {
    return {
      entityNames: lexicalNames,
      mode: "lexical"
    };
  }

  try {
    const knownTables = tables.map((table) => table.tableName).join(", ");
    const parsed = await callGroveForJson(
      [
        "Extract entity names from the question that could exist in a metadata knowledge graph.",
        `Allowed entity types: ${ALLOWED_ENTITY_TYPES.join(", ")}.`,
        `Known table entities: ${knownTables}.`,
        "Return JSON only: { \"entityNames\": [\"...\"] }.",
        "Prefer exact table entity names when the question references warehouse tables, domains, or metrics.",
        `Question: ${question}`
      ].join("\n")
    );

    const entityNames = Array.isArray(parsed.entityNames)
      ? parsed.entityNames.filter((name) => typeof name === "string" && name.trim())
      : lexicalNames;

    return {
      entityNames: entityNames.length > 0 ? entityNames : lexicalNames,
      mode: "grove-entity-extraction"
    };
  } catch (error) {
    console.warn(`[graphrag] entity extraction fallback: ${error.message}`);
    return {
      entityNames: lexicalNames,
      mode: "lexical-fallback"
    };
  }
}

export async function similaritySearch({ db, question, tables, seedTables = [], maxDepth = 3 }) {
  const extraction = await extractEntityNames(question, tables, seedTables);
  const entities = await relatedEntities(db, extraction.entityNames, maxDepth);

  return {
    startingEntities: extraction.entityNames,
    entities,
    extractionMode: extraction.mode
  };
}

export function entitiesToRetrievalContext(entities, tableCatalog, edgeCatalog) {
  const tableNames = new Set(
    entities.filter((entity) => entity.type === "Table").map((entity) => entity._id)
  );

  const tables = tableCatalog
    .filter((table) => tableNames.has(table.tableName))
    .map((table) => ({
      ...table,
      score: 1,
      graphRag: true
    }));

  const edges = [];
  const edgeKeys = new Set();

  for (const entity of entities) {
    if (entity.type !== "Table") {
      continue;
    }

    const targetIds = entity.relationships?.target_ids ?? [];
    const types = entity.relationships?.types ?? [];

    for (let index = 0; index < targetIds.length; index += 1) {
      const targetId = targetIds[index];
      if (!tableNames.has(targetId)) {
        continue;
      }

      const key = `${entity._id}:${targetId}:${types[index] ?? "joins_to"}`;
      if (edgeKeys.has(key)) {
        continue;
      }

      edgeKeys.add(key);
      const matchedEdge =
        edgeCatalog.find(
          (edge) =>
            (edge.sourceTable === entity._id && edge.targetTable === targetId) ||
            (edge.sourceTable === targetId && edge.targetTable === entity._id)
        ) ?? {
          sourceTable: entity._id,
          targetTable: targetId,
          sourceColumn: entity.relationships?.attributes?.[index]?.sourceColumn?.[0] ?? "",
          targetColumn: entity.relationships?.attributes?.[index]?.targetColumn?.[0] ?? "",
          relationshipDescription:
            entity.relationships?.attributes?.[index]?.description?.[0] ??
            "Relationship discovered via GraphRAG traversal.",
          confidence: entity.relationships?.attributes?.[index]?.confidence?.[0] ?? "graphrag"
        };

      edges.push({
        ...matchedEdge,
        graphRag: true
      });
    }
  }

  return { tables, edges };
}

export function getGraphRagMode() {
  return groveConfigured() ? "mongodb-graphrag-grove" : "mongodb-graphrag-lexical";
}
