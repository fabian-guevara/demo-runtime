export const TOWER_SITES = [
  {
    towerId: "tower_1",
    name: "Dallas North",
    market: "DFW",
    region: "South",
    location: { type: "Point", coordinates: [-96.797, 32.7767] }
  },
  {
    towerId: "tower_2",
    name: "Houston East",
    market: "HOU",
    region: "South",
    location: { type: "Point", coordinates: [-95.3698, 29.7604] }
  },
  {
    towerId: "tower_3",
    name: "Austin Central",
    market: "AUS",
    region: "South",
    location: { type: "Point", coordinates: [-97.7431, 30.2672] }
  },
  {
    towerId: "tower_4",
    name: "San Antonio West",
    market: "SAT",
    region: "South",
    location: { type: "Point", coordinates: [-98.4936, 29.4241] }
  },
  {
    towerId: "tower_5",
    name: "Seattle Core",
    market: "SEA",
    region: "West",
    location: { type: "Point", coordinates: [-122.3321, 47.6062] }
  },
  {
    towerId: "tower_6",
    name: "Portland Metro",
    market: "PDX",
    region: "West",
    location: { type: "Point", coordinates: [-122.6765, 45.5152] }
  },
  {
    towerId: "tower_7",
    name: "Miami Beach",
    market: "MIA",
    region: "East",
    location: { type: "Point", coordinates: [-80.1918, 25.7617] }
  },
  {
    towerId: "tower_8",
    name: "Atlanta Midtown",
    market: "ATL",
    region: "East",
    location: { type: "Point", coordinates: [-84.388, 33.749] }
  },
  {
    towerId: "tower_9",
    name: "Chicago Loop",
    market: "CHI",
    region: "Midwest",
    location: { type: "Point", coordinates: [-87.6298, 41.8781] }
  },
  {
    towerId: "tower_10",
    name: "Denver Mountain",
    market: "DEN",
    region: "West",
    location: { type: "Point", coordinates: [-104.9903, 39.7392] }
  }
];

export const HIGH_SEVERITY_MESSAGES = [
  "Critical RF Module failure detected, impacting signal transmission and reception across multiple sectors, requiring immediate attention to restore full service capability.",
  "Antenna VSWR reading is significantly over threshold, indicating a major impedance mismatch that could lead to power loss and potential damage to radio equipment.",
  "Undesirable Passive Intermodulation (PIM) has been detected, causing interference and degrading signal quality within the cell coverage area, affecting user experience.",
  "The antenna tilt alarm has activated, suggesting a physical misalignment of the antenna array which is severely impacting network coverage and subscriber connectivity.",
  "Rectifier output voltage is abnormal, supplying incorrect power levels to sensitive tower equipment, risking hardware damage and unstable network operation.",
  "CPRI/eCPRI Link Failure, indicating a critical communication breakdown between the Baseband Unit and Remote Radio Unit, leading to a complete sector outage."
];

export const NORMAL_MESSAGES = [
  "Routine heartbeat check completed successfully with all KPIs within expected thresholds.",
  "Temperature and humidity readings remain stable across cabinet sensors.",
  "Backhaul utilization is within normal operating range for this time of day.",
  "Battery bank voltage is stable and mains power is healthy.",
  "Sector load balancing completed without intervention."
];

export const RUNBOOK_CHUNKS = [
  {
    title: "RF Module failure",
    alertType: "RF Module failure",
    probableCauses: [
      "Internal hardware fault within the RF module.",
      "Missing or faulty connections to power, fiber, or RF jumpers.",
      "Insufficient or unstable power supply to the module."
    ],
    remediationSteps: [
      "Inspect the RF module and all connections for physical damage or loose seating.",
      "Attempt a soft reset or block/unblock of the affected RF module if supported.",
      "Verify stable power delivery before returning the sector to service."
    ]
  },
  {
    title: "Antenna VSWR threshold breach",
    alertType: "Antenna VSWR",
    probableCauses: [
      "Damaged feeder cable or connector corrosion.",
      "Misaligned antenna or water ingress at the connector."
    ],
    remediationSteps: [
      "Run VSWR sweep on affected antenna ports.",
      "Replace damaged jumpers or connectors and revalidate return loss."
    ]
  },
  {
    title: "Passive intermodulation (PIM)",
    alertType: "PIM",
    probableCauses: [
      "Loose mechanical junctions generating non-linear mixing.",
      "Corroded connectors or foreign material in the RF path."
    ],
    remediationSteps: [
      "Inspect and torque all RF junctions.",
      "Clean or replace connectors showing corrosion or heat damage."
    ]
  },
  {
    title: "CPRI / eCPRI link failure",
    alertType: "CPRI link failure",
    probableCauses: [
      "Fiber break, dirty SFP, or mis-seated transceiver.",
      "RRU or BBU hardware fault after power event."
    ],
    remediationSteps: [
      "Check optical power levels on the affected CPRI link.",
      "Reseat SFP modules and validate link sync after BBU/RRU restart."
    ]
  },
  {
    title: "Rectifier / power distribution fault",
    alertType: "Rectifier fault",
    probableCauses: [
      "Rectifier module failure or overloaded DC plant.",
      "Battery bank unable to sustain load during mains transition."
    ],
    remediationSteps: [
      "Validate rectifier output voltage and current share.",
      "Escalate to field power maintenance if battery autonomy drops below threshold."
    ]
  }
];
