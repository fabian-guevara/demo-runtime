import { getDb } from "../db.js";

const SETTINGS_ID = "ui";

export async function getDemoSettings(db) {
  const settings =
    (await db.collection("demo_settings").findOne({ _id: SETTINGS_ID })) ?? {
      _id: SETTINGS_ID
    };

  return {
    customerSeedCount: settings.customerSeedCount ?? null,
    updatedAt: settings.updatedAt ?? null
  };
}

export async function saveDemoSettings(db, values) {
  const update = {
    updatedAt: new Date().toISOString()
  };

  await db.collection("demo_settings").updateOne(
    { _id: SETTINGS_ID },
    {
      $set: update,
      $setOnInsert: { _id: SETTINGS_ID }
    },
    { upsert: true }
  );

  return update;
}
