# Tower Network Monitoring

Demo powered by:

- **MongoDB native driver** (no Mongoose)
- **MongoDB MCP Server** (`npx mongodb-mcp-server@latest`)
- **Grove LLM** (`gpt-5.5` by default)
- **Voyage embeddings** for manual/runbook vector search
- **Atlas Charts slot** for your geospatial bad-tower map

## Ports

- API: `4003`
- Web: `5178`

## Quick start

```bash
npm install
cp .env.example .env.local
# set MONGODB_URI, GROVE_API_KEY, VOYAGE_API_KEY
npm run seed
npm run dev
```

Open `http://127.0.0.1:5178`.

## Atlas Charts

See [docs/ATLAS_CHARTS.md](./docs/ATLAS_CHARTS.md) for collection shapes and chart build steps.

Paste your embed URL in the demo **Config** button (stored in `demo_settings`).

## Sample flow

1. Seed demo data
2. Start tower simulator
3. Run the sample incident prompt in chat
4. Watch MCP tools query logs + vector search manuals

## Demo runtime

Registered as `chat-with-mongodb-mcp` in the parent demo-runtime dashboard.
