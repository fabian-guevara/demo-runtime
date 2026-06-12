export async function refreshTowerHealth(db) {
  const rollup = await db
    .collection("realtime_network_logs")
    .aggregate([
      {
        $match: {
          event_timestamp: {
            $gte: new Date(Date.now() - 60 * 60 * 1000)
          }
        }
      },
      {
        $group: {
          _id: "$source_tower_id",
          maxSeverity: { $max: "$severity" },
          openAlertCount: {
            $sum: {
              $cond: [{ $gte: ["$severity", 4] }, 1, 0]
            }
          },
          lastEventAt: { $max: "$event_timestamp" },
          lastDescription: { $last: "$event_description" }
        }
      }
    ])
    .toArray();

  const now = new Date();
  const operations = rollup.map((entry) => {
    const status =
      entry.maxSeverity >= 5 ? "critical" : entry.maxSeverity >= 4 ? "degraded" : "healthy";

    return {
      updateOne: {
        filter: { towerId: entry._id },
        update: {
          $set: {
            towerId: entry._id,
            maxSeverity: entry.maxSeverity ?? 0,
            openAlertCount: entry.openAlertCount ?? 0,
            lastEventAt: entry.lastEventAt ?? now,
            lastDescription: entry.lastDescription ?? "",
            status,
            mapColor: status === "healthy" ? "green" : "red",
            updatedAt: now
          }
        },
        upsert: true
      }
    };
  });

  if (operations.length > 0) {
    await db.collection("tower_health").bulkWrite(operations);
  }

  return rollup.length;
}

export async function listTowerMapData(db) {
  const sites = await db.collection("tower_sites").find({}).sort({ towerId: 1 }).toArray();
  const healthDocs = await db
    .collection("tower_health")
    .find({})
    .toArray();
  const healthByTower = new Map(healthDocs.map((doc) => [doc.towerId, doc]));

  return sites.map((site) => {
    const health = healthByTower.get(site.towerId) ?? {
      status: "healthy",
      maxSeverity: 0,
      openAlertCount: 0,
      mapColor: "green"
    };

    return {
      towerId: site.towerId,
      name: site.name,
      market: site.market,
      region: site.region,
      coordinates: site.location.coordinates,
      status: health.status,
      maxSeverity: health.maxSeverity ?? 0,
      openAlertCount: health.openAlertCount ?? 0,
      lastEventAt: health.lastEventAt ?? null,
      lastDescription: health.lastDescription ?? "",
      mapColor: health.mapColor ?? (health.maxSeverity >= 4 ? "red" : "green")
    };
  });
}

export async function setAllTowersHealthy(db) {
  const sites = await db.collection("tower_sites").find({}).sort({ towerId: 1 }).toArray();
  const now = new Date();

  if (sites.length === 0) {
    return { updated: 0 };
  }

  await db.collection("tower_health").bulkWrite(
    sites.map((site) => ({
      updateOne: {
        filter: { towerId: site.towerId },
        update: {
          $set: {
            towerId: site.towerId,
            maxSeverity: 0,
            openAlertCount: 0,
            lastEventAt: now,
            lastDescription: "All towers marked healthy",
            status: "healthy",
            mapColor: "green",
            updatedAt: now
          }
        },
        upsert: true
      }
    }))
  );

  return { updated: sites.length };
}
