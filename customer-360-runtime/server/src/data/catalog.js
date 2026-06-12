export const FIRST_NAMES = [
  "Jamie",
  "Alex",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Avery",
  "Quinn",
  "Drew",
  "Sam",
  "Blake",
  "Cameron",
  "Devon",
  "Harper",
  "Logan",
  "Parker",
  "Reese",
  "Skyler",
  "Rowan"
];

export const LAST_NAMES = [
  "Torres",
  "Nguyen",
  "Patel",
  "Johnson",
  "Williams",
  "Garcia",
  "Chen",
  "Kim",
  "Martinez",
  "Brown",
  "Davis",
  "Wilson",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Clark",
  "Lewis",
  "Walker"
];

export const PLANS = [
  "Magenta Max",
  "Go5G Plus",
  "Go5G Next",
  "Essentials",
  "Business Unlimited Advanced",
  "Home Internet Unlimited",
  "Tablet 10GB",
  "Wearable Connect"
];

export const MARKETS = [
  "NYC",
  "LAX",
  "DFW",
  "HOU",
  "MIA",
  "CHI",
  "ATL",
  "SEA",
  "DEN",
  "PHX",
  "MSP",
  "BOS",
  "SAN",
  "PDX",
  "LAS"
];

export const SEGMENTS = ["postpaid", "prepaid", "business", "home_internet"];

export const DEVICE_MODELS = [
  "iPhone 15 Pro",
  "iPhone SE",
  "Galaxy S24 Ultra",
  "Galaxy A15",
  "Pixel 8 Pro",
  "Moto G Power",
  "iPad Air",
  "Galaxy Tab S9"
];

export const INTERACTION_CHANNELS = ["care_chat", "retail_store", "phone", "app", "social"];

export const INTERACTION_TOPICS = [
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
];

export const SPOTLIGHT_CUSTOMERS = [
  {
    customerId: "C000000001",
    firstName: "Jamie",
    lastName: "Torres",
    msisdn: "7135550101",
    email: "jamie.torres@example.com",
    segment: "postpaid",
    plan: "Magenta Max",
    market: "HOU",
    status: "active",
    ltv: 4820.55,
    churnRisk: 0.82,
    autopay: false,
    lines: 3,
    deviceModel: "iPhone 15 Pro",
    tags: ["billing_escalation", "fiber_eligible"]
  },
  {
    customerId: "C000000002",
    firstName: "Priya",
    lastName: "Shah",
    msisdn: "2145550102",
    email: "priya.shah@northstar-logistics.com",
    segment: "business",
    plan: "Business Unlimited Advanced",
    market: "DFW",
    status: "active",
    ltv: 18420.0,
    churnRisk: 0.21,
    autopay: true,
    lines: 48,
    deviceModel: "Galaxy S24 Ultra",
    tags: ["enterprise", "multi_line"]
  },
  {
    customerId: "C000000003",
    firstName: "Marcus",
    lastName: "Ellis",
    msisdn: "3055550103",
    email: "marcus.ellis@example.com",
    segment: "prepaid",
    plan: "Go5G Plus",
    market: "MIA",
    status: "suspended",
    ltv: 640.2,
    churnRisk: 0.67,
    autopay: false,
    lines: 1,
    deviceModel: "Moto G Power",
    tags: ["payment_failed"]
  },
  {
    customerId: "C000000004",
    firstName: "Elena",
    lastName: "Ruiz",
    msisdn: "6025550104",
    email: "elena.ruiz@example.com",
    segment: "home_internet",
    plan: "Home Internet Unlimited",
    market: "PHX",
    status: "active",
    ltv: 2210.8,
    churnRisk: 0.14,
    autopay: true,
    lines: 2,
    deviceModel: "Galaxy Tab S9",
    tags: ["home_internet", "bundle_candidate"]
  }
];

export const CARE_KB_CHUNKS = [
  {
    title: "High churn risk retention playbook",
    topic: "retention",
    summary: "Steps for customers with churnRisk above 0.7 including billing review and loyalty credits.",
    guidance: [
      "Confirm billing disputes and recent payment failures.",
      "Offer plan right-sizing before discounts.",
      "Escalate to retention offer matrix when LTV exceeds $2,500."
    ]
  },
  {
    title: "Business account escalation",
    topic: "business",
    summary: "How to handle multi-line business accounts with open network or billing tickets.",
    guidance: [
      "Pull last 30 days of interactions across all lines.",
      "Check for duplicate open tickets.",
      "Route enterprise accounts with 25+ lines to business care tier 2."
    ]
  },
  {
    title: "Prepaid suspension recovery",
    topic: "prepaid",
    summary: "Reactivation flow after payment failure on prepaid accounts.",
    guidance: [
      "Verify last successful payment timestamp.",
      "Confirm device IMEI still matches account.",
      "Offer autopay incentive when reactivating."
    ]
  },
  {
    title: "Home internet bundle upgrade",
    topic: "home_internet",
    summary: "Qualification and upsell path for wireless plus home internet bundles.",
    guidance: [
      "Check market fiber eligibility tags.",
      "Review install-related interactions in the last 60 days.",
      "Bundle pricing requires active postpaid or home internet primary line."
    ]
  },
  {
    title: "International roaming billing disputes",
    topic: "billing",
    summary: "Validate roaming charges against plan inclusions and travel dates.",
    guidance: [
      "Match roaming session dates to customer travel window.",
      "Check if international pass was active.",
      "Apply goodwill credit policy once per 12 months."
    ]
  },
  {
    title: "Device upgrade eligibility",
    topic: "device",
    summary: "Determine upgrade eligibility, trade-in value, and EIP balance.",
    guidance: [
      "Confirm tenure and payment history.",
      "Check open EIP balances before quoting upgrade.",
      "Trade-in offers vary by device model and market."
    ]
  }
];
