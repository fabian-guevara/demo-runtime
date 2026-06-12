function mulberry32(seed) {
  let current = seed;

  return () => {
    current |= 0;
    current = (current + 0x6d2b79f5) | 0;
    let t = Math.imul(current ^ (current >>> 15), 1 | current);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function monthStrings() {
  const months = [];
  const base = new Date("2026-05-01T00:00:00.000Z");

  for (let index = 0; index < 18; index += 1) {
    const month = new Date(base);
    month.setUTCMonth(base.getUTCMonth() - index);
    months.push(month.toISOString().slice(0, 7));
  }

  return months.reverse();
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function createDate(month, day, hour = 15) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, day, hour, 0, 0));
}

export function latestDemoMonth() {
  return "2026-05";
}

export function previousDemoMonth() {
  return "2026-04";
}

function flagshipTexasAccounts() {
  return [
    {
      accountId: "acct_001",
      accountName: "Lone Star Logistics",
      industry: "transportation",
      city: "Dallas",
      profile: "network_and_billing"
    },
    {
      accountId: "acct_002",
      accountName: "Gulf Energy Services",
      industry: "energy",
      city: "Houston",
      profile: "network"
    },
    {
      accountId: "acct_003",
      accountName: "Bluebonnet Manufacturing",
      industry: "manufacturing",
      city: "Fort Worth",
      profile: "billing_and_nps"
    },
    {
      accountId: "acct_004",
      accountName: "Austin Robotics Group",
      industry: "technology",
      city: "Austin",
      profile: "nps_and_support"
    },
    {
      accountId: "acct_005",
      accountName: "Panhandle Supply Chain",
      industry: "logistics",
      city: "Amarillo",
      profile: "network_and_support"
    },
    {
      accountId: "acct_006",
      accountName: "Metro Freight Systems",
      industry: "transportation",
      city: "San Antonio",
      profile: "billing"
    },
    {
      accountId: "acct_007",
      accountName: "Dallas Health Partners",
      industry: "healthcare",
      city: "Dallas",
      profile: "nps"
    },
    {
      accountId: "acct_008",
      accountName: "Red River Retail",
      industry: "retail",
      city: "Plano",
      profile: "billing_and_network"
    },
    {
      accountId: "acct_009",
      accountName: "Permian Field Operations",
      industry: "energy",
      city: "Midland",
      profile: "network"
    },
    {
      accountId: "acct_010",
      accountName: "Rio Grande Distribution",
      industry: "distribution",
      city: "McAllen",
      profile: "billing"
    },
    {
      accountId: "acct_011",
      accountName: "Texas Med Devices",
      industry: "healthcare",
      city: "Houston",
      profile: "nps_and_support"
    },
    {
      accountId: "acct_012",
      accountName: "Hill Country Foods",
      industry: "retail",
      city: "Austin",
      profile: "network_and_billing"
    }
  ];
}

function driverCopy(profile) {
  const map = {
    network_and_billing: ["network incidents", "billing disputes"],
    network: ["network incidents", "latency spikes"],
    billing_and_nps: ["billing disputes", "NPS drops"],
    nps_and_support: ["NPS drops", "support ticket volume"],
    network_and_support: ["network incidents", "open support escalations"],
    billing: ["billing disputes", "invoice corrections"],
    nps: ["NPS drops", "executive dissatisfaction"],
    billing_and_network: ["billing disputes", "network incidents"]
  };

  return map[profile] ?? ["network incidents", "billing disputes"];
}

function createFlagshipAccounts(random) {
  return flagshipTexasAccounts().map((account, index) => ({
    accountId: account.accountId,
    accountName: account.accountName,
    segment: "enterprise",
    region: "Texas",
    industry: account.industry,
    city: account.city,
    planType: pick(random, ["5G Business Unlimited", "Private 5G Edge", "Business Voice Advanced"]),
    monthlyRevenue: 110000 + index * 9000,
    activeLines: 2600 + index * 180,
    contractRenewalDate: new Date(`2026-${pad((index % 9) + 1)}-15T00:00:00.000Z`),
    accountManager: `manager_${(index % 4) + 1}`,
    status: "active",
    storyProfile: account.profile
  }));
}

function createBackgroundAccounts(random, startIndex = 13, count = 60) {
  const segments = ["enterprise", "mid-market", "small-business"];
  const regions = ["Texas", "California", "Florida", "Illinois", "Washington", "Georgia", "Colorado"];
  const industries = ["retail", "healthcare", "energy", "logistics", "manufacturing", "financial-services", "hospitality"];
  const plans = ["5G Business Unlimited", "Enterprise IoT Connect", "Private 5G Edge", "Business Voice Advanced"];
  const names = [
    "Pacific Retail Labs",
    "Evergreen Transit",
    "Sunrise Clinical Network",
    "Prairie Industrial Systems",
    "Frontier Energy Ops",
    "Beacon Hospitality Group",
    "Harbor Financial Network",
    "Silverline Manufacturing",
    "Velocity Freight Partners",
    "Westbridge Healthcare",
    "Cascade Industrial Logistics",
    "Northstar Retail Holdings"
  ];

  return Array.from({ length: count }, (_, offset) => {
    const sequence = startIndex + offset;
    const segment = pick(random, segments);
    const region = pick(random, regions);

    return {
      accountId: `acct_${String(sequence).padStart(3, "0")}`,
      accountName: `${names[offset % names.length]} ${sequence}`,
      segment,
      region,
      industry: pick(random, industries),
      city: pick(random, ["Seattle", "Chicago", "Miami", "Atlanta", "Denver", "Phoenix", "San Jose"]),
      planType: pick(random, plans),
      monthlyRevenue: Math.round((segment === "enterprise" ? 65000 : 18000) + random() * (segment === "enterprise" ? 90000 : 38000)),
      activeLines: Math.round((segment === "enterprise" ? 1900 : 220) + random() * (segment === "enterprise" ? 2600 : 800)),
      contractRenewalDate: new Date(`2026-${pad((sequence % 9) + 1)}-15T00:00:00.000Z`),
      accountManager: `manager_${(sequence % 8) + 1}`,
      status: "active",
      storyProfile: null
    };
  });
}

function createUsageMetrics(accounts, months, random) {
  const usageMetrics = [];

  for (const account of accounts) {
    const isFlagshipTexasEnterprise = account.region === "Texas" && account.segment === "enterprise" && account.storyProfile;
    const flagshipDrivers = driverCopy(account.storyProfile);

    months.forEach((month, monthIndex) => {
      const trend = monthIndex / (months.length - 1);
      const latestMonth = month === latestDemoMonth();
      const previousMonth = month === previousDemoMonth();
      const spotlight = isFlagshipTexasEnterprise && (latestMonth || previousMonth);

      let billingDisputes =
        account.segment === "enterprise"
          ? 1 + Math.round(random() * 2)
          : Math.round(random() * 1.2);
      let networkIncidents =
        account.region === "Texas"
          ? Math.round(0.8 + random() * 1.4)
          : Math.round(random() * 1.1);
      let nps = Math.round((account.segment === "enterprise" ? 53 : 59) - trend * 5 + random() * 6);
      let droppedCallRate = round(0.005 + random() * 0.014, 3);
      let supportTickets = Math.round((account.segment === "enterprise" ? 4 : 1) + random() * 9);
      let latency = Math.round(24 + random() * 24);

      if (isFlagshipTexasEnterprise) {
        billingDisputes += flagshipDrivers.some((driver) => driver.includes("billing")) ? 1 : 0;
        networkIncidents += flagshipDrivers.some((driver) => driver.includes("network")) ? 1 : 0;
        supportTickets += 3;
        latency += 7;
        nps -= 5;

        if (previousMonth) {
          billingDisputes += flagshipDrivers.some((driver) => driver.includes("billing")) ? 2 : 1;
          networkIncidents += flagshipDrivers.some((driver) => driver.includes("network")) ? 2 : 1;
          supportTickets += 5;
          latency += 10;
          nps -= 6;
          droppedCallRate = round(droppedCallRate + 0.008, 3);
        }

        if (latestMonth) {
          billingDisputes += flagshipDrivers.some((driver) => driver.includes("billing")) ? 4 : 2;
          networkIncidents += flagshipDrivers.some((driver) => driver.includes("network")) ? 4 : 2;
          supportTickets += 9;
          latency += 18;
          nps -= 12;
          droppedCallRate = round(droppedCallRate + 0.015, 3);
        }
      }

      nps = Math.max(18, nps);

      const churnRiskScore = round(
        Math.min(
          0.92,
          0.18 +
            (account.segment === "enterprise" ? 0.1 : 0.03) +
            (account.region === "Texas" ? 0.03 : 0) +
            billingDisputes * 0.028 +
            networkIncidents * 0.038 +
            Math.max(0, 55 - nps) * 0.006 +
            droppedCallRate * 4.5 +
            (spotlight ? 0.08 : 0)
        ),
        2
      );

      usageMetrics.push({
        accountId: account.accountId,
        month,
        region: account.region,
        segment: account.segment,
        droppedCallRate,
        dataUsageTb: round(14 + random() * 88 + (spotlight ? 6 : 0), 1),
        avgLatencyMs: latency,
        supportTickets,
        billingDisputes,
        nps,
        networkIncidents,
        churnRiskScore
      });
    });
  }

  return usageMetrics;
}

function createStoryInteractions(flagshipAccounts, months) {
  const recentMonths = [previousDemoMonth(), latestDemoMonth()];
  const templates = {
    network_and_billing: [
      "Leadership escalated repeated billing disputes after credits were delayed while Dallas network incidents kept warehouse teams on backup connectivity.",
      "Customer reported latency spikes near {city} distribution centers and tied the frustration directly to unresolved billing corrections.",
      "Executive sponsor said churn risk is rising because network incidents and invoice disputes are hitting the same leadership review."
    ],
    network: [
      "Customer reported packet loss and jitter across {city} field sites and asked for a formal churn-risk mitigation plan.",
      "Support summary linked rising churn risk to repeated network incidents during peak operating hours near {city}.",
      "Account leadership said service instability is now a board-level topic for the {city} rollout."
    ],
    billing_and_nps: [
      "Billing dispute volume increased after plan changes were invoiced incorrectly, and NPS dropped sharply in the latest executive review.",
      "Customer success noted that unresolved invoice corrections are driving NPS decline across the {city} leadership team.",
      "Executive sponsor asked why billing disputes remain open while renewal risk climbs."
    ],
    nps_and_support: [
      "Leadership escalated a sustained NPS drop after multiple support tickets remained open longer than promised.",
      "Customer summary tied churn concerns to executive dissatisfaction with incident communications in {city}.",
      "Open escalations and weak status updates pushed the account's NPS below internal expectations."
    ],
    network_and_support: [
      "Support tickets piled up after recurring network incidents disrupted branch operations in {city}.",
      "Leadership asked for a clearer recovery timeline because unresolved network incidents are now affecting renewal confidence.",
      "Customer summary said incident fatigue and slow support follow-through are reinforcing churn risk."
    ],
    billing: [
      "Billing disputes around contract amendments remained unresolved and became a renewal-risk talking point.",
      "Finance leadership challenged recurring invoice corrections and warned the account is losing confidence.",
      "Support noted that billing disputes are showing up in every executive QBR for the {city} account."
    ],
    nps: [
      "Executive feedback showed a visible NPS drop after two months of inconsistent account communication.",
      "Leadership said the relationship feels reactive instead of strategic and tied that directly to churn risk.",
      "Customer summary highlighted that NPS deterioration is now more concerning than raw incident count."
    ],
    billing_and_network: [
      "Simultaneous billing disputes and network incidents pushed the account into elevated churn-risk review.",
      "Leadership said both invoice friction and service instability are undermining trust in the {city} account team.",
      "Account interaction summary linked churn risk to unresolved credits plus repeated network disruptions."
    ]
  };

  const interactions = [];
  let counter = 1;

  for (const account of flagshipAccounts) {
    for (const month of recentMonths) {
      const monthTemplates = templates[account.storyProfile] ?? templates.network_and_billing;

      monthTemplates.forEach((template, templateIndex) => {
        interactions.push({
          interactionId: `support_${String(counter).padStart(3, "0")}`,
          accountId: account.accountId,
          region: account.region,
          segment: account.segment,
          createdAt: createDate(month, 6 + templateIndex * 5),
          channel: templateIndex % 2 === 0 ? "email" : "meeting",
          severity: month === latestDemoMonth() ? "high" : "medium",
          category:
            account.storyProfile.includes("billing")
              ? "billing"
              : account.storyProfile.includes("network")
                ? "network_performance"
                : "customer_success",
          summary: template.replaceAll("{city}", account.city),
          resolutionStatus: month === latestDemoMonth() ? "open" : "monitoring"
        });
        counter += 1;
      });
    }
  }

  return {
    interactions,
    nextCounter: counter
  };
}

function createBackgroundInteractions(accounts, random, startCounter, count = 420) {
  const templates = [
    "Customer asked for a follow-up on service quality trends after recent branch expansion.",
    "Support ticket referenced sporadic latency variation during peak operational windows.",
    "Account team captured concern about slower escalation response than expected.",
    "Customer requested a summary of recent incidents before upcoming renewal planning.",
    "Operations contact noted that ticket closure clarity matters more than raw outage count.",
    "Billing contact requested confirmation that service adjustments were reflected in the latest invoice."
  ];

  return Array.from({ length: count }, (_, index) => {
    const account = pick(random, accounts);
    const month = index % 5 === 0 ? latestDemoMonth() : pick(random, [previousDemoMonth(), "2026-03", "2026-02", "2026-01"]);

    return {
      interactionId: `support_${String(startCounter + index).padStart(3, "0")}`,
      accountId: account.accountId,
      region: account.region,
      segment: account.segment,
      createdAt: createDate(month, (index % 25) + 1, 13),
      channel: pick(random, ["email", "phone", "slack", "meeting"]),
      severity: pick(random, ["low", "medium", "high"]),
      category: pick(random, ["network_performance", "billing", "customer_success", "incident_follow_up"]),
      summary: templates[index % templates.length],
      resolutionStatus: pick(random, ["open", "monitoring", "resolved"])
    };
  });
}

function createIncidentSummaries(random) {
  const storyIncidents = [
    {
      incidentId: "incident_001",
      month: previousDemoMonth(),
      region: "Texas",
      segment: "enterprise",
      severity: "sev2",
      summary: "Dallas metro packet loss increased during peak fulfillment windows, contributing to leadership concern for Texas enterprise churn risk.",
      rootCause: "Backhaul congestion during traffic surge",
      mitigation: "Temporary reroute applied while capacity rebalancing completed."
    },
    {
      incidentId: "incident_002",
      month: latestDemoMonth(),
      region: "Texas",
      segment: "enterprise",
      severity: "sev2",
      summary: "Houston business voice instability and elevated latency increased pressure on enterprise accounts already tracking higher churn risk.",
      rootCause: "Regional route instability after maintenance window",
      mitigation: "Voice traffic shifted and circuit tuning completed."
    },
    {
      incidentId: "incident_003",
      month: latestDemoMonth(),
      region: "Texas",
      segment: "enterprise",
      severity: "sev3",
      summary: "Fort Worth radio optimization regression increased dropped calls for transportation and manufacturing accounts.",
      rootCause: "Parameter rollback needed after optimization push",
      mitigation: "Rollback completed and monitoring extended through business peak."
    },
    {
      incidentId: "incident_004",
      month: previousDemoMonth(),
      region: "Texas",
      segment: "enterprise",
      severity: "sev3",
      summary: "Austin private 5G degradation increased support volume and reinforced recent NPS decline for executive stakeholders.",
      rootCause: "Edge routing imbalance",
      mitigation: "Routing policies adjusted and customer communications standardized."
    }
  ];

  const regionalTemplates = [
    ["California", "Core maintenance caused elevated latency for west coast accounts.", "Planned maintenance overlap", "Rollback completed and monitoring resumed."],
    ["Florida", "Storm-related fiber disruption reduced redundancy for branch connectivity.", "Last-mile outage", "Carrier repair completed."],
    ["Illinois", "Chicago metro congestion increased latency during the midday peak.", "Unexpected traffic concentration", "Capacity balancing completed."],
    ["Washington", "Seattle IoT traffic burst degraded response time for a subset of enterprise endpoints.", "Burst routing imbalance", "Traffic shifted to reserve capacity."],
    ["Georgia", "Atlanta voice edge issue affected selected business customers.", "Carrier interconnect instability", "Interconnect path re-optimized."]
  ];

  const incidents = storyIncidents.map((incident, index) => ({
    incidentId: incident.incidentId,
    createdAt: createDate(incident.month, 8 + index * 3, 10),
    region: incident.region,
    segment: incident.segment,
    affectedServices: pick(random, [["5G", "business_voice"], ["private_5g"], ["iot_connect", "5G"]]),
    severity: incident.severity,
    summary: incident.summary,
    rootCause: incident.rootCause,
    mitigation: incident.mitigation
  }));

  for (let index = 0; index < 92; index += 1) {
    const [region, summary, rootCause, mitigation] = regionalTemplates[index % regionalTemplates.length];
    const month = index % 4 === 0 ? latestDemoMonth() : index % 3 === 0 ? previousDemoMonth() : pick(random, ["2026-03", "2026-02", "2026-01", "2025-12"]);

    incidents.push({
      incidentId: `incident_${String(index + 5).padStart(3, "0")}`,
      createdAt: createDate(month, (index % 24) + 1, 9),
      region,
      segment: region === "Texas" ? "enterprise" : pick(random, ["enterprise", "mid-market", "small-business"]),
      affectedServices: pick(random, [["5G", "business_voice"], ["private_5g"], ["iot_connect", "5G"]]),
      severity: pick(random, ["sev2", "sev3"]),
      summary,
      rootCause,
      mitigation
    });
  }

  return incidents;
}

export function generateSampleData() {
  const random = mulberry32(20260526);
  const months = monthStrings();
  const flagshipAccounts = createFlagshipAccounts(random);
  const backgroundAccounts = createBackgroundAccounts(random);
  const accounts = [...flagshipAccounts, ...backgroundAccounts];
  const usageMetrics = createUsageMetrics(accounts, months, random);
  const storyInteractionBundle = createStoryInteractions(flagshipAccounts, months);
  const backgroundInteractions = createBackgroundInteractions(accounts, random, storyInteractionBundle.nextCounter);
  const supportInteractions = [...storyInteractionBundle.interactions, ...backgroundInteractions];
  const incidentSummaries = createIncidentSummaries(random);

  return {
    months,
    accounts,
    usageMetrics,
    supportInteractions,
    incidentSummaries,
    agentCheckpoints: [],
    agentMemories: [],
    demoTelemetry: []
  };
}
