export function churnRiskPipeline({ region, segment, month }) {
  return [
    {
      $match: {
        region,
        segment,
        month
      }
    },
    {
      $lookup: {
        from: "accounts",
        localField: "accountId",
        foreignField: "accountId",
        as: "account"
      }
    },
    {
      $unwind: "$account"
    },
    {
      $match: {
        "account.status": "active"
      }
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              avgChurnRiskScore: { $avg: "$churnRiskScore" },
              avgNps: { $avg: "$nps" },
              avgBillingDisputes: { $avg: "$billingDisputes" },
              avgNetworkIncidents: { $avg: "$networkIncidents" },
              avgDroppedCallRate: { $avg: "$droppedCallRate" },
              totalRevenueAtRisk: {
                $sum: {
                  $multiply: ["$account.monthlyRevenue", "$churnRiskScore"]
                }
              },
              accountCount: { $sum: 1 }
            }
          }
        ],
        highRiskAccounts: [
          {
            $sort: {
              churnRiskScore: -1
            }
          },
          {
            $limit: 5
          },
          {
            $project: {
              _id: 0,
              accountId: 1,
              churnRiskScore: 1,
              nps: 1,
              billingDisputes: 1,
              networkIncidents: 1,
              droppedCallRate: 1,
              accountName: "$account.accountName",
              monthlyRevenue: "$account.monthlyRevenue"
            }
          }
        ]
      }
    }
  ];
}

export function comparisonPipeline({ region, segment, currentMonth, previousMonth }) {
  return [
    {
      $match: {
        region,
        segment,
        month: {
          $in: [currentMonth, previousMonth]
        }
      }
    },
    {
      $group: {
        _id: "$month",
        avgChurnRiskScore: { $avg: "$churnRiskScore" },
        avgNps: { $avg: "$nps" },
        avgBillingDisputes: { $avg: "$billingDisputes" },
        avgNetworkIncidents: { $avg: "$networkIncidents" },
        avgDroppedCallRate: { $avg: "$droppedCallRate" }
      }
    }
  ];
}

export function vectorSearchStage({
  indexName,
  queryVector,
  path = "embedding",
  limit = 4,
  filter = null,
  numCandidates = null
}) {
  return {
    $vectorSearch: {
      index: indexName,
      path,
      queryVector,
      numCandidates: numCandidates ?? Math.max(limit * 8, 20),
      limit,
      ...(filter ? { filter } : {})
    }
  };
}

export function latestAccountIssuePipeline({ region, segment, month, category }) {
  return [
    {
      $match: {
        ...(region ? { region } : {}),
        ...(segment ? { segment } : {}),
        ...(category ? { category } : {})
      }
    },
    {
      $sort: {
        createdAt: -1
      }
    },
    {
      $limit: 1
    },
    {
      $lookup: {
        from: "accounts",
        localField: "accountId",
        foreignField: "accountId",
        as: "account"
      }
    },
    {
      $unwind: "$account"
    },
    {
      $lookup: {
        from: "usage_metrics",
        let: {
          accountId: "$accountId"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$accountId", "$$accountId"]
                  },
                  {
                    $eq: ["$month", month]
                  }
                ]
              }
            }
          },
          {
            $project: {
              _id: 0,
              churnRiskScore: 1,
              billingDisputes: 1,
              nps: 1,
              networkIncidents: 1,
              month: 1
            }
          }
        ],
        as: "latestUsage"
      }
    },
    {
      $addFields: {
        latestUsage: {
          $first: "$latestUsage"
        }
      }
    },
    {
      $project: {
        _id: 0,
        accountId: 1,
        accountName: "$account.accountName",
        region: 1,
        segment: 1,
        category: 1,
        createdAt: 1,
        channel: 1,
        severity: 1,
        summary: 1,
        resolutionStatus: 1,
        accountManager: "$account.accountManager",
        monthlyRevenue: "$account.monthlyRevenue",
        latestUsage: 1
      }
    }
  ];
}
