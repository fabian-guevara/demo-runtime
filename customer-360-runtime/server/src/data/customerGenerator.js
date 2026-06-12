import {
  DEVICE_MODELS,
  FIRST_NAMES,
  LAST_NAMES,
  MARKETS,
  PLANS,
  SEGMENTS,
  SPOTLIGHT_CUSTOMERS
} from "./catalog.js";

export function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function pick(list, seed) {
  return list[Math.floor(pseudoRandom(seed) * list.length) % list.length];
}

export function formatCustomerId(n) {
  return `C${String(n).padStart(9, "0")}`;
}

function formatMsisdn(n) {
  const areaCodes = ["713", "214", "305", "602", "404", "206", "303", "312", "617", "415"];
  const area = pick(areaCodes, n + 11);
  const suffix = String(1_000_000 + (n % 9_000_000)).slice(-7);
  return `${area}${suffix}`;
}

export function buildCustomer(n) {
  const spotlight = SPOTLIGHT_CUSTOMERS.find((entry) => entry.customerId === formatCustomerId(n));
  if (spotlight) {
    const joinDate = new Date(Date.UTC(2019 + (n % 5), n % 12, (n % 27) + 1));
    return {
      ...spotlight,
      searchableName: `${spotlight.firstName} ${spotlight.lastName}`,
      joinDate,
      updatedAt: new Date()
    };
  }

  const segment = pick(SEGMENTS, n);
  const market = pick(MARKETS, n + 3);
  const statusRoll = pseudoRandom(n + 7);
  const status = statusRoll > 0.93 ? "churned" : statusRoll > 0.88 ? "suspended" : "active";
  const churnRisk = Number((pseudoRandom(n + 13) * 0.95).toFixed(2));
  const ltv = Number((120 + pseudoRandom(n + 17) * 9800).toFixed(2));
  const firstName = pick(FIRST_NAMES, n + 19);
  const lastName = pick(LAST_NAMES, n + 23);
  const customerId = formatCustomerId(n);

  return {
    customerId,
    msisdn: formatMsisdn(n),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${n}@example.com`,
    firstName,
    lastName,
    searchableName: `${firstName} ${lastName}`,
    segment,
    plan: pick(PLANS, n + 29),
    market,
    status,
    ltv,
    joinDate: new Date(Date.UTC(2016 + (n % 9), n % 12, (n % 28) + 1)),
    churnRisk,
    autopay: pseudoRandom(n + 31) > 0.35,
    lines: segment === "business" ? 5 + (n % 40) : 1 + (n % 4),
    deviceModel: pick(DEVICE_MODELS, n + 37),
    tags: churnRisk > 0.75 ? ["high_churn_risk"] : [],
    updatedAt: new Date()
  };
}

export function buildCustomerBatch(startIndex, batchSize) {
  const documents = new Array(batchSize);
  for (let offset = 0; offset < batchSize; offset += 1) {
    documents[offset] = buildCustomer(startIndex + offset);
  }
  return documents;
}

export function buildInteraction(customerId, sequence, nowMs) {
  const seed = Number(customerId.slice(1)) + sequence * 17;
  const topicRoll = pseudoRandom(seed);
  const sentiment =
    topicRoll > 0.72 ? "negative" : topicRoll > 0.45 ? "neutral" : "positive";

  return {
    interactionId: `${customerId}-I${String(sequence).padStart(4, "0")}`,
    customerId,
    channel: pick(["care_chat", "retail_store", "phone", "app", "social"], seed + 1),
    topic: pick(
      [
        "billing_dispute",
        "plan_change",
        "device_upgrade",
        "network_complaint",
        "autopay_setup",
        "international_roaming",
        "trade_in",
        "home_internet_install",
        "account_recovery",
        "loyalty_offer"
      ],
      seed + 2
    ),
    sentiment,
    resolved: sentiment !== "negative" || pseudoRandom(seed + 3) > 0.35,
    summary:
      sentiment === "negative"
        ? "Customer reported an unresolved billing or service issue."
        : "Routine account servicing completed successfully.",
    occurredAt: new Date(nowMs - sequence * 86_400_000 - (seed % 7200) * 1000)
  };
}

export function buildInteractionBatch(totalCustomers, batchSize, startIndex = 0, nowMs = Date.now()) {
  const documents = new Array(batchSize);
  for (let index = 0; index < batchSize; index += 1) {
    const globalIndex = startIndex + index;
    const customerNumber = 1 + (globalIndex % totalCustomers);
    const customerId = formatCustomerId(customerNumber);
    const sequence = 1 + Math.floor(globalIndex / totalCustomers);
    documents[index] = buildInteraction(customerId, sequence, nowMs);
  }
  return documents;
}
