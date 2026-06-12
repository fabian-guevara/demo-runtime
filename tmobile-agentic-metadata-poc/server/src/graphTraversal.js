function buildAdjacency(edges) {
  const adjacency = new Map();

  for (const edge of edges) {
    if (!adjacency.has(edge.sourceTable)) {
      adjacency.set(edge.sourceTable, []);
    }

    if (!adjacency.has(edge.targetTable)) {
      adjacency.set(edge.targetTable, []);
    }

    adjacency.get(edge.sourceTable).push({
      nextTable: edge.targetTable,
      edge
    });
    adjacency.get(edge.targetTable).push({
      nextTable: edge.sourceTable,
      edge
    });
  }

  return adjacency;
}

function normalize(text) {
  return String(text).toLowerCase();
}

export function extractMentionedTables(question, allTables) {
  const normalizedQuestion = normalize(question);
  return allTables
    .filter((table) => normalizedQuestion.includes(table.tableName.replaceAll("_", " ")))
    .map((table) => table.tableName);
}

function bfsPath(start, target, adjacency) {
  const queue = [[start, []]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const [current, path] = queue.shift();

    if (current === target) {
      return path;
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.nextTable)) {
        continue;
      }

      visited.add(neighbor.nextTable);
      queue.push([neighbor.nextTable, [...path, neighbor.edge]]);
    }
  }

  return [];
}

export function resolveJoinPath(tableNames, allEdges) {
  if (tableNames.length <= 1) {
    return [];
  }

  const adjacency = buildAdjacency(allEdges);
  const selectedEdges = [];
  const edgeKeys = new Set();
  const root = tableNames[0];

  for (const target of tableNames.slice(1)) {
    const path = bfsPath(root, target, adjacency);

    for (const edge of path) {
      const key = `${edge.sourceTable}:${edge.sourceColumn}:${edge.targetTable}:${edge.targetColumn}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        selectedEdges.push(edge);
      }
    }
  }

  return selectedEdges;
}

export function expandGraph({ question, retrievedTables, retrievedEdges, allTables, allEdges }) {
  const mentionedTables = extractMentionedTables(question, allTables);
  const seedTableNames = new Set([
    ...mentionedTables,
    ...retrievedTables.slice(0, 4).map((table) => table.tableName),
    ...retrievedEdges.slice(0, 4).flatMap((edge) => [edge.sourceTable, edge.targetTable])
  ]);

  const candidateEdges = allEdges.filter(
    (edge) => seedTableNames.has(edge.sourceTable) || seedTableNames.has(edge.targetTable)
  );
  const candidateTableNames = new Set([
    ...seedTableNames,
    ...candidateEdges.flatMap((edge) => [edge.sourceTable, edge.targetTable])
  ]);

  return {
    mentionedTables,
    candidateTables: allTables.filter((table) => candidateTableNames.has(table.tableName)),
    candidateEdges
  };
}
