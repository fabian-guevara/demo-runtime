import { MongoClient } from "mongodb";
import env from "./config/env.js";

let clientPromise;

export function getDbName() {
  return env.mongodbDb;
}

function summarizeMongoUri(uri = "") {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?]+)/i);
  const userMatch = uri.match(/^mongodb(?:\+srv)?:\/\/([^:@/]+)(?::([^@]+))?@/i);

  return {
    host: match?.[1] ?? null,
    user: userMatch?.[1] ?? null,
    hasPassword: Boolean(userMatch?.[2])
  };
}

function createClient() {
  const uri = env.mongodbUri;

  if (!uri) {
    throw new Error("MONGODB_URI is required.");
  }

  return new MongoClient(uri, {
    appName: "tmobile-agentic-metadata-poc"
  });
}

export async function getMongoClient() {
  if (!clientPromise) {
    const target = summarizeMongoUri(env.mongodbUri);

    try {
      const client = createClient();
      clientPromise = client.connect();
      await clientPromise;
      console.info("[mongodb] connected", target);
    } catch (error) {
      console.error("[mongodb] connect failed", {
        ...target,
        message: error.message
      });
      clientPromise = null;
      throw error;
    }
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(getDbName());
}

export async function closeMongoClient() {
  if (!clientPromise) {
    return;
  }

  const client = await clientPromise;
  await client.close();
  clientPromise = null;
}
