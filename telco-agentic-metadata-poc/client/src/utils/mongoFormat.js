function renderArgument(value) {
  return JSON.stringify(value, null, 2);
}

export function formatMongoStatement(action) {
  const collectionName = action.collectionName ?? "collection";
  const operation = action.operation ?? "find";
  const query = action.query ?? {};

  if (operation === "aggregate") {
    const pipeline = Array.isArray(query) ? query : query.pipeline ?? [];
    return `db.${collectionName}.aggregate(${renderArgument(pipeline)})`;
  }

  if (operation === "find" || operation === "findOne") {
    const filter = query.filter ?? query;
    const options = query.options;
    if (options) {
      return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(options)})`;
    }

    return `db.${collectionName}.${operation}(${renderArgument(filter)})`;
  }

  if (operation === "search") {
    return `db.${collectionName}.aggregate(${renderArgument([
      {
        $vectorSearch: query
      }
    ])})`;
  }

  if (operation === "updateOne" || operation === "updateMany") {
    const filter = query.filter ?? {};
    const update = query.update ?? {};
    const options = query.options;
    if (options) {
      return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(update)}, ${renderArgument(options)})`;
    }

    return `db.${collectionName}.${operation}(${renderArgument(filter)}, ${renderArgument(update)})`;
  }

  if (operation === "deleteMany" || operation === "deleteOne") {
    return `db.${collectionName}.${operation}(${renderArgument(query.filter ?? query)})`;
  }

  if (operation === "insertOne") {
    const document = query.document ?? query;
    return `db.${collectionName}.insertOne(${renderArgument(document)})`;
  }

  return `db.${collectionName}.${operation}(${renderArgument(query)})`;
}
