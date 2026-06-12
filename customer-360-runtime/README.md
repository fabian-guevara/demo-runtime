# Customer 360 Command Center

Care and retention command center over 1M+ customer profiles with Atlas Search lookup, interaction history, MCP cohort analysis, and care knowledge retrieval.

## Stack

- **MongoDB native driver** (no Mongoose)
- **Atlas Search** (`$search`) for customer lookup with fuzzy matching
- **Atlas Vector Search** on `care_kb` for retention guidance
- **MongoDB MCP Server** for agent analytics tools
- **Grove LLM** (`gpt-5.5` by default)
- **Voyage embeddings** for care knowledge at seed and query time

## Ports

- API: `4004`
- Web: `5179`

## Quick start

```bash
npm install
cp .env.example .env.local
# set MONGODB_URI, GROVE_API_KEY, VOYAGE_API_KEY
npm run seed
npm run indexes
npm run dev
```

Open `http://127.0.0.1:5179`.

## Sample flow

1. Search for a customer by name, email, phone, or account ID
2. Open the 360 profile (plan, churn score, interactions, billing)
3. Ask the agent for retention guidance backed by `care_kb` vector search
4. Inspect MongoDB operations in the runtime terminal panel

## Demo runtime

Registered as `customer-360` in the parent `demo-runtime` dashboard.

Architecture reference: `../demos/architecture/customer-360.html`
