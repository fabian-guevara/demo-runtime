import { getDb } from "../db.js";

const SETTINGS_ID = "ui";

export async function getDemoSettings(db) {
  const settings =
    (await db.collection("demo_settings").findOne({ _id: SETTINGS_ID })) ?? {
      _id: SETTINGS_ID,
      atlasChartsTowerMapEmbedUrl: "",
      atlasChartsTowerDashboardEmbedUrl: ""
    };

  return {
    atlasChartsTowerMapEmbedUrl: settings.atlasChartsTowerMapEmbedUrl ?? "",
    atlasChartsTowerDashboardEmbedUrl: settings.atlasChartsTowerDashboardEmbedUrl ?? ""
  };
}

export async function saveDemoSettings(db, values) {
  const update = {
    atlasChartsTowerMapEmbedUrl: values.atlasChartsTowerMapEmbedUrl?.trim() ?? "",
    atlasChartsTowerDashboardEmbedUrl: values.atlasChartsTowerDashboardEmbedUrl?.trim() ?? "",
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
