# Demo Runtime

`demo-runtime` is a lightweight launcher, control plane, and observability wrapper for MongoDB demo repos. It is intentionally not a monolith. Each demo remains a clean standalone repo, while this runtime handles local credentials, process launching, cluster wake-up, and "What did we run?" telemetry.

## What this repo includes

- MERN-style runtime shell with a React dashboard and an Express API.
- MongoDB Node.js driver dependency, without Mongoose.
- AWS Bedrock test endpoint using the Bedrock Runtime Converse API.
- VoyageAI embedding test endpoint with `voyage-4` as the default model and simple env override support.
- Demo manifests in `demos/*.json`.
- A copyable `.demo/runtime-tracker.js` helper for MongoDB action telemetry.

## Quick start

1. Copy `.env.example` to `.env` and fill in whatever shared defaults you want.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open `http://localhost:5173`.
5. If any required values are still missing, use the dashboard's `Configure` button. Missing values are stored locally in `apps/api/.env.local` and ignored by git.

The API runs on `http://localhost:4000` and the frontend runs on `http://localhost:5173` by default.

## Environment variables

Shared variables used by the runtime:

- `API_PORT`
- `WEB_PORT`
- `WEB_ORIGIN`
- `DEMO_RUNTIME_URL`
- `MONGODB_URI`
- `GROVE_API_KEY`
- `GROVE_MODEL`
- `GROVE_API_URL`
- `VOYAGE_API_KEY`
- `VOYAGE_EMBEDDING_MODEL`

`VOYAGE_EMBEDDING_MODEL` defaults to `voyage-4`. Swap to `voyage-4-lite` or `voyage-4-large` by changing the env value only.

## Demo manifest contract

This runtime reads demo manifests from `demos/*.json`. Each manifest points to a standalone repo and declares the local commands the runtime may run. Example fields:

- `id`
- `name`
- `description`
- `repoPath`
- `clusterName`
- `requiredEnv`
- `commands.setup`
- `commands.seed`
- `commands.start`
- `commands.reset`
- `actionsEndpoint`
- `appUrl`
- `memory`

The manifests in `demos/*.json` target these active demos:

| Demo ID | Folder | API / Web |
|---|---|---|
| `customer-360` | `customer-360-runtime` | 4004 / 5179 |
| `ai-analytics-agent` | `tmobile-ai-analytics-agent` | 4001 / 5174 |
| `agentic-metadata-poc` | `tmobile-agentic-metadata-poc` | 4002 / 5177 |
| `chat-with-mongodb-mcp` | `chat-with-mongodb-mcp-runtime` | 4003 / 5178 |

Each demo also ships a matching architecture page under `demos/architecture/<demo-id>.html`.

If a repo path is missing locally, the dashboard still renders the card and shows an error state until the folder exists.

## Demo repo `.demo` folder

Each standalone demo repo should carry its runtime integration in a small hidden folder:

```text
.demo/
  manifest.json
  setup.sh
  seed.sh
  start.sh
  reset.sh
  actions.json
  runtime-tracker.js
```

Today, the runtime reads `demos/*.json` in this repo as the source of truth. The `.demo` folder in each standalone repo keeps the integration portable and isolated so customer-facing repos stay clean.

Copy the helper from [.demo/runtime-tracker.js](./.demo/runtime-tracker.js) into each standalone demo repo. It sends MongoDB action telemetry back to this runtime when `DEMO_RUNTIME_URL` is set, and falls back to `.demo/telemetry.jsonl` if the runtime is unavailable.

## What did we run?

Every MongoDB-touching workflow should wrap its operation with `trackedMongoAction(...)`. The runtime UI can then show:

- action name
- MCP tool name
- MongoDB operation
- database and collection
- query or aggregation pipeline
- Atlas Search or Vector Search stages
- duration
- returned count
- explain summary
- LLM model
- embedding model
- short-term memory context

The API accepts telemetry at `POST /api/telemetry/ingest` and surfaces recent entries through:

- `GET /api/telemetry`
- `GET /api/demos/:id/actions`

Secrets are redacted before they reach runtime logs.

## Runtime API

Implemented endpoints:

- `GET /api/demos`
- `POST /api/demos/:id/setup`
- `POST /api/demos/:id/seed`
- `POST /api/demos/:id/start`
- `POST /api/demos/:id/reset`
- `POST /api/demos/:id/stop`
- `GET /api/demos/:id/actions`
- `POST /api/clusters/start`
- `GET /api/telemetry`
- `DELETE /api/telemetry`
- `POST /api/telemetry/ingest`
- `POST /api/credentials`
- `POST /api/llm/test`
- `POST /api/embeddings/test`

The runtime launches commands with `child_process.spawn`, streams stdout and stderr into the telemetry panel, and keeps a small in-memory process registry for started demos.

## Starting paused Atlas clusters

When a demo cluster is paused, or when an operator wants to warm it explicitly, the runtime calls:

```bash
start-cluster <cluster-name>
```

This is exposed through `POST /api/clusters/start` and the dashboard's `Start cluster` button. If the command is missing or exits non-zero, the terminal panel shows the failure.

## Bedrock usage

`POST /api/llm/test` accepts:

```json
{
  "prompt": "Give me a short demo summary."
}
```

The backend uses AWS SDK v3 and the Bedrock Runtime Converse API. It no longer assumes long-lived access key and secret env vars, so AWS credentials can come from a token or the default AWS credential chain. Errors are normalized to call out common issues:

- missing AWS credentials or region
- missing model access
- invalid `BEDROCK_MODEL_ID`
- region and model mismatch

## VoyageAI embeddings

`POST /api/embeddings/test` accepts:

```json
{
  "text": "T-Mobile enterprise churn risk"
}
```

The response returns the configured model, embedding dimensions, and only the first five numbers of the vector preview.

## Atlas Vector Search and short-term memory

The runtime is ready to display telemetry for Atlas Search and Atlas Vector Search stages whenever a demo reports them through `trackedMongoAction`.

For `tmobile-ai-analytics-agent`, the sample manifest also reserves UI space for MongoDB-backed short-term memory details such as:

- `conversationId`
- checkpoint collection
- last checkpoint timestamp
- follow-up context

That sets up follow-up flows like:

- User: `Show churn risk for Texas enterprise accounts`
- User: `Now compare that to last month`

The second request can resolve `that` from MongoDB-backed LangGraph checkpoints inside the standalone demo repo.

## Adding a new demo

1. Add a new manifest in `demos/<demo-id>.json`.
2. Point `repoPath` at the standalone repo.
3. Declare `requiredEnv`, `clusterName`, `commands`, `actionsEndpoint`, and `appUrl`.
4. Add or update the standalone repo's `.demo` folder so it can emit telemetry with `runtime-tracker.js`.
5. Restart `npm run dev` if you want a clean reload, or simply refresh the dashboard if the API is already running.

## Notes

- Secrets are never committed. Keep `.env.local`, `apps/api/.env.local`, and demo `.env.local` files untracked.
- Superseded local folders (`intelligent-connectivity-ops-runtime`, `original-chat-with-mongodb-mcp`) are gitignored; the active demos are the four manifests above.
- This runtime is intentionally opinionated about local development and observability, not about owning demo business logic.
