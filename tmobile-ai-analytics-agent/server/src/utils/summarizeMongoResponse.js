function redactLargeVectors(value) {
  if (Array.isArray(value)) {
    if (value.length > 16 && value.every((item) => typeof item === "number")) {
      return `[${value.length}-dim vector]`;
    }

    return value.map(redactLargeVectors);
  }

  if (value && typeof value === "object") {
    const next = {};

    for (const [key, entry] of Object.entries(value)) {
      if (key === "embedding" && Array.isArray(entry) && entry.length > 16) {
        next[key] = `[${entry.length}-dim vector]`;
      } else {
        next[key] = redactLargeVectors(entry);
      }
    }

    return next;
  }

  return value;
}

export function summarizeMongoResponse(result) {
  if (result === undefined) {
    return null;
  }

  if (result === null) {
    return null;
  }

  if (typeof result !== "object") {
    return result;
  }

  if (Array.isArray(result)) {
    return redactLargeVectors(result);
  }

  if ("insertedId" in result || "acknowledged" in result) {
    return {
      acknowledged: result.acknowledged ?? null,
      insertedId: result.insertedId ?? null,
      insertedCount: result.insertedCount ?? null,
      matchedCount: result.matchedCount ?? null,
      modifiedCount: result.modifiedCount ?? null,
      upsertedId: result.upsertedId ?? null,
      deletedCount: result.deletedCount ?? null
    };
  }

  if ("deletedCount" in result && Object.keys(result).length <= 3) {
    return {
      acknowledged: result.acknowledged ?? null,
      deletedCount: result.deletedCount ?? null
    };
  }

  return redactLargeVectors(result);
}
