import { getDb } from "../config/db.js";
import env from "../config/env.js";
import { trackedMongoAction } from "./telemetryService.js";

export class MongoShortTermMemoryAdapter {
  async saveCheckpoint({ conversationId, state }) {
    const db = await getDb();
    await db.collection("agent_checkpoints").updateOne(
      { conversationId },
      {
        $set: {
          conversationId,
          state,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  }

  async getCheckpoint({ conversationId }) {
    const db = await getDb();
    return db.collection("agent_checkpoints").findOne({ conversationId });
  }

  async clearCheckpoint({ conversationId }) {
    const db = await getDb();
    await db.collection("agent_checkpoints").deleteOne({ conversationId });
  }
}

const adapter = new MongoShortTermMemoryAdapter();

export async function saveTurn(conversationId, userMessage, toolCalls, answer, resolvedContext) {
  if (!env.enableShortTermMemory) {
    return;
  }

  const existing = await adapter.getCheckpoint({ conversationId });
  const history = existing?.state?.history ?? [];
  const nextState = {
    history: [
      ...history.slice(-5),
      {
        userMessage,
        answer,
        toolCalls,
        resolvedContext,
        timestamp: new Date().toISOString()
      }
    ],
    lastResolvedContext: resolvedContext
  };
  const updatedAt = new Date().toISOString();
  const checkpointFilter = {
    conversationId
  };
  const checkpointUpdate = {
    $set: {
      conversationId,
      state: nextState,
      updatedAt
    }
  };
  const checkpointOptions = {
    upsert: true
  };

  const db = await getDb();
  await trackedMongoAction({
    name: "Save short-term checkpoint",
    toolName: "shortTermMemory",
    dbName: db.databaseName,
    collectionName: "agent_checkpoints",
    operation: "updateOne",
    query: {
      filter: checkpointFilter,
      update: checkpointUpdate,
      options: checkpointOptions
    },
    memory: {
      type: "short-term",
      conversationId
    },
    run: async () =>
      db
        .collection("agent_checkpoints")
        .updateOne(checkpointFilter, checkpointUpdate, checkpointOptions)
  });
}

export async function getConversationState(conversationId) {
  if (!env.enableShortTermMemory || !conversationId) {
    return null;
  }

  const checkpoint = await adapter.getCheckpoint({ conversationId });
  return checkpoint?.state ?? null;
}

export async function resolveFollowUp(conversationId, message) {
  const state = await getConversationState(conversationId);

  if (!state?.lastResolvedContext) {
    return null;
  }

  if (!/\bthat\b|\bthose\b|\bcompare\b|\blast month\b/i.test(message)) {
    return null;
  }

  return state.lastResolvedContext;
}
