# Atlas Charts data model for tower map

Build the map in **MongoDB Atlas Charts** against database **`network_monitoring`**.

## Recommended chart

- **Chart type:** Geospatial (Points)
- **Primary collection:** `tower_sites`
- **Color / size encoding:** join or lookup to `tower_health`

## Collections

### `tower_sites`

Static tower locations.

```json
{
  "towerId": "tower_2",
  "name": "Houston East",
  "market": "HOU",
  "region": "South",
  "location": {
    "type": "Point",
    "coordinates": [-95.3698, 29.7604]
  },
  "createdAt": "2026-06-04T12:00:00.000Z"
}
```

**Index:** `2dsphere` on `location`, unique on `towerId`.

### `tower_health`

Rollup used for red/green tower status. Refreshed by seed, simulator, and log inserts.

```json
{
  "towerId": "tower_2",
  "maxSeverity": 5,
  "openAlertCount": 8,
  "lastEventAt": "2026-06-04T12:05:00.000Z",
  "lastDescription": "Critical RF Module failure detected...",
  "status": "critical",
  "mapColor": "red",
  "updatedAt": "2026-06-04T12:05:01.000Z"
}
```

**Status values**

| status | mapColor | Rule |
|---|---|---|
| `healthy` | `green` | `maxSeverity < 4` |
| `degraded` | `red` | `maxSeverity === 4` |
| `critical` | `red` | `maxSeverity >= 5` |

**Index:** unique on `towerId`, optional index on `status`.

### `realtime_network_logs`

Live telemetry events (time-ordered).

```json
{
  "source_tower_id": "tower_2",
  "event_id": "uuid",
  "event_description": "Critical RF Module failure detected...",
  "category": "SymmetricDS",
  "severity": 5,
  "event_timestamp": "2026-06-04T12:05:00.000Z"
}
```

**Indexes:** `{ event_timestamp: -1 }`, `{ source_tower_id: 1, event_timestamp: -1 }`, `{ severity: -1 }`.

## What to build in Atlas Charts (plain language)

### Tower map (required)

In Atlas Charts, create a **Geospatial** chart on database **`network_monitoring`**.

- Pick collection **`tower_sites`**
- Use field **`location`** as the geography — Charts will place one point per tower on the map
- Add related data from **`tower_health`** (same tower id) so each point knows if the site is healthy
- In the chart builder, color or size the points by health — red when **`maxSeverity` is 4 or higher**, green otherwise
- Tooltips: tower name, last alert text, severity

That chart answers: *where are the bad towers right now?*

Paste its embed URL into **Tower map embed URL** in the demo Config button.

### Tower dashboard (optional)

Create a **second** chart on the same database — this one is about **events over time**, not geography.

- Pick collection **`realtime_network_logs`**
- Chart types that work well: **Line** (alerts over time), **Grouped Column** (counts by tower), or **Number** (how many severity‑4+ events in the last hour)
- Filter to recent timestamps and high severity if you want an “ops dashboard” feel

That chart answers: *how much bad stuff is happening, and when?*

Paste its embed URL into **Tower dashboard embed URL**. Optional for now — the demo saves it even though only the map is shown today.

## Chart build steps (technical)

1. Run **Seed** in the demo to populate `tower_sites`, `tower_health`, and sample logs.
2. In Charts, create a **Geospatial** chart on `tower_sites.location`.
3. Add a **lookup** (or blended data source) from `tower_health` on `towerId`.
4. Color points when `tower_health.mapColor === "red"` or `tower_health.maxSeverity >= 4`.
5. Tooltip fields: `tower_sites.name`, `tower_health.maxSeverity`, `tower_health.lastDescription`.
6. Copy the **Embed chart** iframe URL.
7. In the demo UI, click **Config** and paste the URL into **Tower map embed URL**.

The URL is stored in MongoDB:

```json
{
  "_id": "ui",
  "atlasChartsTowerMapEmbedUrl": "https://charts.mongodb.com/embed/...",
  "atlasChartsTowerDashboardEmbedUrl": ""
}
```

## Optional dashboard chart

Use `realtime_network_logs` for a time-series or KPI chart (alerts in last 15 minutes, severity >= 4). Paste that embed URL into **Tower dashboard embed URL**.

## Vector search (manuals)

Collection: `manuals`

```json
{
  "title": "RF Module failure",
  "alertType": "RF Module failure",
  "probableCauses": ["..."],
  "remediationSteps": ["..."],
  "searchableText": "...",
  "embedding": [0.01, "..."]
}
```

Atlas Vector Search index: **`manuals_vector_index`** on path `embedding` (1024 dims, cosine) when `VOYAGE_API_KEY` is set.
