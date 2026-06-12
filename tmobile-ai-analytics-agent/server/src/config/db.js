import { MongoClient } from "mongodb";
import env from "./env.js";

let clientPromise;

function createClient() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required.");
  }

  return new MongoClient(env.mongodbUri, {
    appName: "tmobile-ai-analytics-agent"
  });
}

export async function getMongoClient() {
  if (!clientPromise) {
    const client = createClient();
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getMongoClient();
  return client.db(env.mongodbDbName);
}

export async function closeMongoClient() {
  if (!clientPromise) {
    return;
  }

  const client = await clientPromise;
  await client.close();
  clientPromise = null;
}
