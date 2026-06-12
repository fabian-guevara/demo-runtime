import { getDb } from "../config/db.js";
import env from "../config/env.js";
import { embedText } from "./embeddingService.js";
import { vectorSearchWithFallback } from "./vectorRetrieval.js";
import { trackedMongoAction } from "./telemetryService.js";

function namespaceValue(namespace) {
  return Array.isArray(namespace) ? namespace : [namespace];
}

export class MongoLongTermMemoryAdapter {
  async putMemory({ namespace, key, value, metadata, embedding }) {
    const db = await getDb();
    await db.collection("agent_memories").updateOne(
      {
        namespace,
        key
      },
      {
        $set: {
          namespace,
          key,
          memoryText: value,
          metadata,
          embedding,
          updatedAt: new Date().toISOString()
        },
        $setOnInsert: {
          createdAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  }

  async searchMemories({ namespace, query, limit = 5 }) {
    return vectorSearchWithFallback({
      collectionName: "agent_memories",
      indexName: "agent_memories_vector_index",
      query,
      textField: "memoryText",
      filter: {
        namespace
      },
      limit,
      toolName: "searchLongTermMemory",
      name: "Search long-term memory",
      projection: {
        namespace: 1,
        key: 1,
        memoryText: 1,
        metadata: 1,
        createdAt: 1,
        updatedAt: 1
      }
    });
  }

  async deleteMemory({ namespace, key }) {
    const db = await getDb();
    await db.collection("agent_memories").deleteOne({ namespace, key });
  }

  async listMemories({ namespace }) {
    const db = await getDb();
    return db.collection("agent_memories").find({ namespace }, { sort: { updatedAt: -1 } }).toArray();
  }

  async clearNamespace({ namespace }) {
    const db = await getDb();
    await db.collection("agent_memories").deleteMany({ namespace });
  }
}

const adapter = new MongoLongTermMemoryAdapter();

export async function putMemory({ namespace, key, value, metadata }) {
  const normalizedNamespace = namespaceValue(namespace);
  const db = await getDb();
  const now = new Date().toISOString();
  const { embedding, model } = await embedText({
    text: value,
    inputType: "document"
  });
  const filter = {
    namespace: normalizedNamespace,
    key
  };
  const update = {
    $set: {
      namespace: normalizedNamespace,
      key,
      memoryText: value,
      metadata,
      embedding,
      updatedAt: now
    },
    $setOnInsert: {
      createdAt: now
    }
  };
  const options = {
    upsert: true
  };

  const { telemetryId } = await trackedMongoAction({
    name: "Store long-term memory",
    toolName: "rememberPreference",
    dbName: db.databaseName,
    collectionName: "agent_memories",
    operation: "updateOne",
    query: {
      filter,
      update,
      options
    },
    embeddingModel: model,
    memory: {
      type: "long-term",
      namespace: normalizedNamespace
    },
    run: async () =>
      adapter.putMemory({
        namespace: normalizedNamespace,
        key,
        value,
        metadata,
        embedding
      })
  });

  return {
    namespace: normalizedNamespace,
    key,
    telemetryId
  };
}

export async function searchMemories({ namespace, query, limit = 5 }) {
  if (!env.enableLongTermMemory) {
    return {
      memories: [],
      telemetryId: null
    };
  }

  const normalizedNamespace = namespaceValue(namespace);
  const search = await vectorSearchWithFallback({
    collectionName: "agent_memories",
    indexName: "agent_memories_vector_index",
    query,
    textField: "memoryText",
    filter: {
      namespace: normalizedNamespace
    },
    limit,
    toolName: "searchLongTermMemory",
    name: "Search long-term memory",
    projection: {
      namespace: 1,
      key: 1,
      memoryText: 1,
      metadata: 1,
      createdAt: 1,
      updatedAt: 1
    }
  });

  return {
    memories: search.docs,
    telemetryId: search.telemetryId
  };
}

export async function listMemories({ namespace }) {
  const normalizedNamespace = namespaceValue(namespace);
  const db = await getDb();

  const { result, telemetryId } = await trackedMongoAction({
    name: "List long-term memories",
    toolName: "listMemories",
    dbName: db.databaseName,
    collectionName: "agent_memories",
    operation: "find",
    query: {
      filter: {
        namespace: normalizedNamespace
      },
      options: {
        sort: {
          updatedAt: -1
        }
      }
    },
    memory: {
      type: "long-term",
      namespace: normalizedNamespace
    },
    run: async () => adapter.listMemories({ namespace: normalizedNamespace })
  });

  return {
    memories: result,
    telemetryId
  };
}

export async function clearMemories({ namespace }) {
  const normalizedNamespace = namespaceValue(namespace);
  const db = await getDb();

  const { telemetryId } = await trackedMongoAction({
    name: "Clear long-term memories",
    toolName: "clearMemories",
    dbName: db.databaseName,
    collectionName: "agent_memories",
    operation: "deleteMany",
    query: {
      filter: {
        namespace: normalizedNamespace
      }
    },
    memory: {
      type: "long-term",
      namespace: normalizedNamespace
    },
    run: async () => adapter.clearNamespace({ namespace: normalizedNamespace })
  });

  return {
    cleared: true,
    telemetryId
  };
}
