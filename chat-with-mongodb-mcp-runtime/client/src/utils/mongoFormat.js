function renderArgument(value) {
  return JSON.stringify(value, null, 2);
}

export function formatMongoStatement(action) {
  const collectionName = action.collectionName ?? "collection";
  const operation = action.operation ?? "find";
  const query = action.query ?? {};

  if (operation === "aggregate" || operation === "aggregate-db") {
    const pipeline = Array.isArray(query) ? query : query.pipeline ?? query.filter ?? [];
    return `db.${collectionName}.aggregate(${renderArgument(pipeline)})`;
  }

  if (operation === "find" || operation === "findOne") {
    const filter = query.filter ?? query;
    const options = query.options ?? query.projection;
    if (options) {
      return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(options)})`;
    }

    return `db.${collectionName}.${operation}(${renderArgument(filter)})`;
  }

  if (operation.includes("search")) {
    return `db.${collectionName}.aggregate(${renderArgument([
      {
        $vectorSearch: query
      }
    ])})`;
  }

  if (operation === "count") {
    return `db.${collectionName}.countDocuments(${renderArgument(query.filter ?? query)})`;
  }

  return `db.${collectionName}.${operation}(${renderArgument(query)})`;
}
