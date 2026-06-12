import { getDb } from "../config/db.js";
import { churnRiskPipeline, comparisonPipeline, latestAccountIssuePipeline } from "../mongo/queries.js";
import { trackedMongoAction } from "./telemetryService.js";

function round(value, digits = 2) {
  return Number((value ?? 0).toFixed(digits));
}

function previousMonthString(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function topRiskDrivers(summary) {
  const drivers = [
    {
      name: "billing disputes",
      score: summary.avgBillingDisputes ?? 0
    },
    {
      name: "network incidents",
      score: summary.avgNetworkIncidents ?? 0
    },
    {
      name: "dropped call rate",
      score: (summary.avgDroppedCallRate ?? 0) * 100
    },
    {
      name: "NPS drop",
      score: Math.max(0, 55 - (summary.avgNps ?? 55))
    }
  ];

  return drivers.sort((left, right) => right.score - left.score).slice(0, 3).map((driver) => driver.name);
}

export async function getChurnRiskMetrics({ region, segment, month, toolName = "getChurnRisk" }) {
  const db = await getDb();
  const pipeline = churnRiskPipeline({ region, segment, month });

  const { result, telemetryId } = await trackedMongoAction({
    name: `Churn risk analytics for ${region} ${segment} ${month}`,
    toolName,
    dbName: db.databaseName,
    collectionName: "usage_metrics",
    operation: "aggregate",
    query: pipeline,
    run: async () => db.collection("usage_metrics").aggregate(pipeline).toArray(),
    explain: async () => db.collection("usage_metrics").aggregate(pipeline).explain()
  });

  const summary = result[0]?.summary?.[0] ?? {};
  const metrics = {
    region,
    segment,
    month,
    avgChurnRiskScore: round(summary.avgChurnRiskScore),
    highRiskAccounts: result[0]?.highRiskAccounts ?? [],
    avgNps: round(summary.avgNps),
    totalRevenueAtRisk: Math.round(summary.totalRevenueAtRisk ?? 0),
    avgBillingDisputes: round(summary.avgBillingDisputes),
    avgNetworkIncidents: round(summary.avgNetworkIncidents),
    avgDroppedCallRate: round(summary.avgDroppedCallRate, 3),
    accountCount: summary.accountCount ?? 0,
    topRiskDrivers: topRiskDrivers(summary)
  };

  return {
    ...metrics,
    telemetryId
  };
}

export async function compareChurnRiskMetrics({ region, segment, currentMonth, previousMonth = previousMonthString(currentMonth), toolName = "compareChurnRisk" }) {
  const db = await getDb();
  const pipeline = comparisonPipeline({ region, segment, currentMonth, previousMonth });

  const { result, telemetryId } = await trackedMongoAction({
    name: `Churn risk comparison for ${region} ${segment}`,
    toolName,
    dbName: db.databaseName,
    collectionName: "usage_metrics",
    operation: "aggregate",
    query: pipeline,
    run: async () => db.collection("usage_metrics").aggregate(pipeline).toArray(),
    explain: async () => db.collection("usage_metrics").aggregate(pipeline).explain()
  });

  const current = result.find((item) => item._id === currentMonth) ?? {};
  const previous = result.find((item) => item._id === previousMonth) ?? {};
  const delta = round((current.avgChurnRiskScore ?? 0) - (previous.avgChurnRiskScore ?? 0));

  return {
    currentMonth,
    previousMonth,
    current: {
      avgChurnRiskScore: round(current.avgChurnRiskScore),
      avgNps: round(current.avgNps),
      avgBillingDisputes: round(current.avgBillingDisputes),
      avgNetworkIncidents: round(current.avgNetworkIncidents),
      avgDroppedCallRate: round(current.avgDroppedCallRate, 3)
    },
    previous: {
      avgChurnRiskScore: round(previous.avgChurnRiskScore),
      avgNps: round(previous.avgNps),
      avgBillingDisputes: round(previous.avgBillingDisputes),
      avgNetworkIncidents: round(previous.avgNetworkIncidents),
      avgDroppedCallRate: round(previous.avgDroppedCallRate, 3)
    },
    delta,
    interpretation:
      delta > 0
        ? "Churn risk increased versus the previous month."
        : delta < 0
          ? "Churn risk improved versus the previous month."
          : "Churn risk is flat versus the previous month.",
    driverDeltas: {
      billingDisputes: round((current.avgBillingDisputes ?? 0) - (previous.avgBillingDisputes ?? 0)),
      networkIncidents: round((current.avgNetworkIncidents ?? 0) - (previous.avgNetworkIncidents ?? 0)),
      droppedCallRate: round((current.avgDroppedCallRate ?? 0) - (previous.avgDroppedCallRate ?? 0), 3),
      nps: round((current.avgNps ?? 0) - (previous.avgNps ?? 0))
    },
    telemetryId
  };
}

export async function getCustomerSegments() {
  const db = await getDb();

  const { result, telemetryId } = await trackedMongoAction({
    name: "List customer segments",
    toolName: "getCustomerSegments",
    dbName: db.databaseName,
    collectionName: "accounts",
    operation: "aggregate",
    query: [
      {
        $group: {
          _id: null,
          regions: { $addToSet: "$region" },
          segments: { $addToSet: "$segment" }
        }
      }
    ],
    run: async () =>
      db
        .collection("accounts")
        .aggregate([
          {
            $group: {
              _id: null,
              regions: { $addToSet: "$region" },
              segments: { $addToSet: "$segment" }
            }
          }
        ])
        .toArray()
  });

  return {
    regions: result[0]?.regions?.sort() ?? [],
    segments: result[0]?.segments?.sort() ?? [],
    telemetryId
  };
}

export async function getLatestAccountIssue({
  region,
  segment,
  month,
  issueType = "billing",
  toolName = "getLatestAccountIssue"
}) {
  const db = await getDb();
  const categoryMap = {
    billing: "billing",
    network: "network_performance",
    support: "customer_success"
  };
  const category = categoryMap[issueType] ?? "billing";
  const pipeline = latestAccountIssuePipeline({
    region,
    segment,
    month,
    category
  });

  const { result, telemetryId } = await trackedMongoAction({
    name: `Latest ${issueType} account issue for ${region} ${segment}`,
    toolName,
    dbName: db.databaseName,
    collectionName: "support_interactions",
    operation: "aggregate",
    query: pipeline,
    run: async () => db.collection("support_interactions").aggregate(pipeline).toArray(),
    explain: async () => db.collection("support_interactions").aggregate(pipeline).explain()
  });

  return {
    issueType,
    month,
    latestIssue: result[0] ?? null,
    telemetryId
  };
}
