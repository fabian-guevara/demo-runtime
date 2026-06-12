import env from "../config/env.js";
import {
  CUSTOMER_AUTOCOMPLETE_PATHS,
  CUSTOMERS_SEARCH_INDEX_DEFINITION
} from "../config/customersSearchIndex.js";

const CUSTOMER_PROJECTION = {
  _id: 0,
  customerId: 1,
  firstName: 1,
  lastName: 1,
  msisdn: 1,
  email: 1,
  segment: 1,
  plan: 1,
  market: 1,
  status: 1,
  churnRisk: 1,
  ltv: 1
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFuzzyOptions(trimmed, { autocomplete = false } = {}) {
  const length = trimmed.length;

  return {
    // Two edits only on longer queries — maxEdits: 2 + prefixLength: 0 on
    // short strings (e.g. "jamei") incorrectly pulls unrelated names.
    maxEdits: length >= 6 ? 2 : 1,
    // Allow first-character typos (kameron → cameron).
    prefixLength: 0,
    maxExpansions: autocomplete ? 48 : 64
  };
}

function buildSearchCompound(trimmed, segment) {
  const compound = {
    must: [
      {
        text: {
          query: trimmed,
          path: ["searchableName", "firstName", "lastName", "email", "msisdn", "customerId"],
          fuzzy: buildFuzzyOptions(trimmed)
        }
      }
    ]
  };

  if (segment) {
    compound.filter = [{ equals: { path: "segment", value: segment } }];
  }

  return compound;
}

export async function atlasSearchCustomers(db, { q, segment = "", limit = 20 } = {}) {
  const trimmed = String(q ?? "").trim();
  if (!trimmed) {
    return null;
  }

  const pipeline = [
    {
      $search: {
        index: env.customersSearchIndex,
        compound: buildSearchCompound(trimmed, segment)
      }
    },
    { $limit: Math.min(limit, 50) },
    {
      $project: {
        ...CUSTOMER_PROJECTION,
        searchScore: { $meta: "searchScore" }
      }
    }
  ];

  return db.collection("customers").aggregate(pipeline).toArray();
}

function buildAutocompleteCompound(trimmed, segment) {
  const fuzzy = buildFuzzyOptions(trimmed, { autocomplete: true });
  const compound = {
    should: CUSTOMER_AUTOCOMPLETE_PATHS.map((path) => ({
      autocomplete: {
        query: trimmed,
        path,
        fuzzy
      }
    })),
    minimumShouldMatch: 1
  };

  if (segment) {
    compound.filter = [{ equals: { path: "segment", value: segment } }];
  }

  return compound;
}

export async function autocompleteCustomers(db, { q = "", segment = "", limit = 8 } = {}) {
  const trimmed = String(q ?? "").trim();
  if (trimmed.length < 2) {
    return [];
  }

  const pipeline = [
    {
      $search: {
        index: env.customersSearchIndex,
        compound: buildAutocompleteCompound(trimmed, segment)
      }
    },
    { $limit: Math.min(limit, 12) },
    {
      $project: {
        ...CUSTOMER_PROJECTION,
        searchScore: { $meta: "searchScore" }
      }
    }
  ];

  try {
    const results = await db.collection("customers").aggregate(pipeline).toArray();
    return results.map(({ searchScore, ...customer }) => customer);
  } catch (error) {
    console.warn(`[search] autocomplete fallback: ${error.message}`);
    return regexSearchCustomers(db, { q: trimmed, segment, limit });
  }
}

export async function regexSearchCustomers(db, { q = "", segment = "", limit = 20 } = {}) {
  const filter = {};
  const trimmed = q.trim();

  if (segment) {
    filter.segment = segment;
  }

  if (trimmed) {
    const regex = new RegExp(escapeRegex(trimmed), "i");
    filter.$or = [
      { customerId: regex },
      { msisdn: regex },
      { email: regex },
      { firstName: regex },
      { lastName: regex },
      { searchableName: regex }
    ];
  }

  return db
    .collection("customers")
    .find(filter, { projection: CUSTOMER_PROJECTION })
    .sort({ churnRisk: -1, ltv: -1 })
    .limit(Math.min(limit, 50))
    .toArray();
}

export async function searchCustomers(db, { q = "", segment = "", limit = 20 } = {}) {
  const trimmed = q.trim();
  const cap = Math.min(limit, 50);

  if (trimmed) {
    try {
      const atlasResults = await atlasSearchCustomers(db, { q: trimmed, segment, limit: cap });
      if (atlasResults?.length) {
        return {
          customers: atlasResults.map(({ searchScore, ...customer }) => customer),
          searchMode: null
        };
      }
    } catch (error) {
      console.warn(`[search] Atlas Search fallback for customers: ${error.message}`);
    }

    return {
      customers: await regexSearchCustomers(db, { q: trimmed, segment, limit: cap }),
      searchMode: "regex_degraded"
    };
  }

  const filter = segment ? { segment } : {};
  const customers = await db
    .collection("customers")
    .find(filter, { projection: CUSTOMER_PROJECTION })
    .sort({ churnRisk: -1, ltv: -1 })
    .limit(cap)
    .toArray();

  return { customers, searchMode: null };
}

export async function getCustomerStats(db) {
  const stats =
    (await db.collection("customer_stats").findOne({ _id: "summary" })) ??
    ({
      totalCustomers: await db.collection("customers").estimatedDocumentCount(),
      highChurnRiskActive: await db.collection("customers").countDocuments({
        churnRisk: { $gte: 0.75 },
        status: "active"
      }),
      segments: [],
      updatedAt: new Date()
    });

  return {
    totalCustomers: stats.totalCustomers ?? 0,
    highChurnRiskActive: stats.highChurnRiskActive ?? 0,
    segments: stats.segments ?? [],
    updatedAt: stats.updatedAt ?? null
  };
}

export async function getCustomerProfile(db, customerId) {
  const customer = await db.collection("customers").findOne(
    { customerId },
    {
      projection: { _id: 0 }
    }
  );

  if (!customer) {
    return null;
  }

  const interactions = await db
    .collection("interactions")
    .find({ customerId }, { projection: { _id: 0 } })
    .sort({ occurredAt: -1 })
    .limit(12)
    .toArray();

  return {
    customer,
    interactions
  };
}

export async function lookupCustomer(db, query) {
  const trimmed = String(query ?? "").trim();
  if (!trimmed) {
    return [];
  }

  const exact = await db
    .collection("customers")
    .find(
      {
        $or: [{ customerId: trimmed }, { msisdn: trimmed }, { email: trimmed }]
      },
      { projection: CUSTOMER_PROJECTION }
    )
    .limit(5)
    .toArray();

  if (exact.length) {
    return exact;
  }

  try {
    const atlasResults = await autocompleteCustomers(db, { q: trimmed, limit: 5 });
    if (atlasResults.length) {
      return atlasResults;
    }

    const textResults = await atlasSearchCustomers(db, { q: trimmed, limit: 5 });
    if (textResults?.length) {
      return textResults.map(({ searchScore, ...customer }) => customer);
    }
  } catch (error) {
    console.warn(`[search] Atlas Search fallback for lookup: ${error.message}`);
  }

  return regexSearchCustomers(db, { q: trimmed, limit: 5 });
}

export async function getSegmentInsights(db, { segment = "", market = "" } = {}) {
  const match = {};
  if (segment) {
    match.segment = segment;
  }
  if (market) {
    match.market = market;
  }

  const [summary, topRisk] = await Promise.all([
    db
      .collection("customers")
      .aggregate([
        ...(Object.keys(match).length ? [{ $match: match }] : []),
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgChurnRisk: { $avg: "$churnRisk" },
            avgLtv: { $avg: "$ltv" },
            activeCount: {
              $sum: {
                $cond: [{ $eq: ["$status", "active"] }, 1, 0]
              }
            }
          }
        }
      ])
      .toArray(),
    db
      .collection("customers")
      .find(match, {
        projection: CUSTOMER_PROJECTION
      })
      .sort({ churnRisk: -1 })
      .limit(5)
      .toArray()
  ]);

  return {
    summary: summary[0] ?? null,
    topRisk
  };
}
