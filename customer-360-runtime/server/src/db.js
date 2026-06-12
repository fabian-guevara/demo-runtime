import { MongoClient } from "mongodb";
import env from "./config/env.js";

let client;
let db;

export async function getDb() {
  if (db) {
    return db;
  }

  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required.");
  }

  client = new MongoClient(env.mongodbUri, {
    appName: "customer-360-runtime"
  });

  await client.connect();
  db = client.db(env.mongodbDbName);
  console.log("[mongodb] connected", {
    host: new URL(env.mongodbUri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://")).hostname,
    database: env.mongodbDbName
  });

  return db;
}

export async function closeMongoClient() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}
