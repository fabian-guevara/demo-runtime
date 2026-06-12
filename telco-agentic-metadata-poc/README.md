# Agentic Metadata Planner

`telco-agentic-metadata-poc` is a MongoDB-powered POC for the agentic retrieval and query-planning layer that sits in front of a warehouse or lakehouse. The demo focuses on schema discovery, relationship reasoning, metadata-grounded query planning, and SQL draft generation rather than generic document RAG.

MongoDB is the application-facing agentic metadata serving layer. It does not replace Databricks, Redshift, or Snowflake execution engines.

## What This POC Demonstrates

- MongoDB storing table metadata as `table_nodes`
- MongoDB storing join relationships as `table_edges`
- Optional Voyage or Atlas embedding generation when `VOYAGE_API_KEY` is present
- Atlas Vector Search over metadata embeddings when indexes are available
- Explicit lexical degraded retrieval when vector search or embeddings are unavailable
- GraphRAG traversal with MongoDB `$graphLookup` over `metadata_knowledge_graph`
- BusinessConcept, Metric, Domain, Owner, and PolicyClassification graph nodes
- Metadata-grounded query planning with validation against catalog tables, columns, and edges
- Generic SQL draft generation from validated plans only
- Grove as the LLM gateway for planning, explanation, and MongoDB alternative sketches
- Governance visibility for classification, PII, owners, and allowed roles
- Persisted `query_runs` for demo traceability

## What MongoDB Is Doing

- Storing schema metadata, sample fields, sample rows, tags, and governance fields
- Storing relationship metadata and join confidence
- Storing optional embeddings for vector retrieval
- Serving vector retrieval when Atlas Vector Search is available
- Serving lexical degraded retrieval when vector search is unavailable
- Traversing a metadata knowledge graph with `$graphLookup`
- Persisting prior query runs and demo telemetry

## What MongoDB Is Not Doing

- Replacing Databricks, Redshift, or the warehouse execution engine
- Automatically inferring customer schema from nothing
- Running final SQL against the warehouse in this demo
- Returning production-certified SQL
- Answering questions outside the loaded metadata catalog

## Architecture

```text
/server
  /src
    index.js
    db.js
    seed.js
    embeddings.js
    retrieval.js
    graphRagStore.js
    graphTraversal.js
    queryPlanner.js
    planValidator.js
    sqlGenerator.js
    governance.js
    llm.js
    routes.js
/client
  /src
    App.jsx
    api.js
    /components
/.demo
  manifest.json
  setup.sh
  seed.sh
  start.sh
```

## Collections

- `table_nodes`
- `table_edges`
- `query_examples`
- `metadata_knowledge_graph`
- `query_runs`

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start local MongoDB if you are not pointing at Atlas:

   ```bash
   docker compose up -d
   ```

3. Copy `.env.example` to `.env` or `.env.local` and configure credentials.

4. Seed the catalog:

   ```bash
   npm run seed
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

6. Open the UI at `http://127.0.0.1:5177`.

## Environment Variables

### Required for full demo runtime

- `MONGODB_URI` — MongoDB connection string
- `GROVE_API_KEY` — Grove LLM gateway key when `REQUIRE_LLM=true`

### Optional

- `MONGODB_DB_NAME` — defaults to `agentic_metadata_demo`
- `GROVE_MODEL` — defaults to `gpt-5.5`
- `GROVE_BASE_URL` — Grove OpenAI-compatible responses endpoint
- `GROVE_TIMEOUT_MS` — Grove request timeout in milliseconds
- `VOYAGE_API_KEY` — Voyage platform key or Atlas model key (`al-...`)
- `EMBEDDING_MODEL` — defaults to `voyage-4`
- `VOYAGE_EMBEDDING_DIMENSIONS` — defaults to `1024`
- `QUERY_LIMIT_DEFAULT` — safe SQL row limit, defaults to `100`

### Feature flags

- `REQUIRE_VECTOR_SEARCH=false` — fail requests when vector search is unavailable
- `REQUIRE_EMBEDDINGS=false` — fail requests when embeddings cannot be generated
- `REQUIRE_LLM=true` — fail requests when Grove is unavailable or returns invalid JSON
- `ENFORCE_POLICY=false` — block requests when policy warnings are present

## Runtime Modes

### LLM

- Provider: Grove only
- `llmMode: grove` when `GROVE_API_KEY` is configured
- `llmMode: metadata_only` when Grove is unavailable and `REQUIRE_LLM=false`
- Malformed Grove JSON returns `LLM_VALIDATION_FAILED` after one retry

### Embeddings

- `embeddingMode: voyage | atlas | unavailable`
- If embeddings are unavailable, retrieval may continue in lexical degraded mode unless `REQUIRE_EMBEDDINGS=true`

### Retrieval

- `retrieval.mode: vector | lexical_degraded | unavailable`
- Lexical degraded mode is explicitly labeled in the API and UI
- If `REQUIRE_VECTOR_SEARCH=true`, the API fails when vector search is unavailable

### Graph

- `graph.mode: graph_lookup | degraded | unavailable`
- Uses MongoDB `$graphLookup` over `metadata_knowledge_graph`
- Includes BusinessConcept, Metric, Domain, Owner, and PolicyClassification evidence

## `/api/query` Response Shape

The API returns a stable structured response with:

- `answer`
- `retrieval.mode`, `retrieval.results`, `retrieval.warnings`
- `graph.mode`, `graph.paths`, `graph.evidence`
- `plan.isValid`, tables, columns, joins, filters, metrics, assumptions, confidence
- `sql.status`, `sql.text`, `sql.warnings`
- `mongodbAlternative.summary`, `collections`, `pipelineSketch`
- `governance.policyWarnings`, `governance.sensitiveFields`
- `debug.timings`, `llmMode`, `embeddingMode`, `retrievalMode`, `graphMode`

## Sample Prompts

Supported examples:

- Which tables help analyze churn risk after plan migration?
- How do I join billing disputes to high-value customers?
- Which fields should I use to analyze network usage by customer segment?
- What data is needed to investigate support cases after a plan change?

Unsupported examples should return clear limitations, not fake answers:

- Show me customer credit card numbers.
- Predict churn for every customer now.
- Query a warehouse table that is not in the metadata catalog.

## Atlas Vector Search Indexes

Index JSON definitions live in:

- `server/src/vectorIndexes/table_nodes_vector_index.json`
- `server/src/vectorIndexes/table_edges_vector_index.json`

Create those indexes in Atlas Search / Vector Search if you want real vector retrieval. The index expects `embedding` vectors with 1024 dimensions.

## Running On demo-runtime

This repo includes a `.demo` folder and a runtime manifest entry:

- `.demo/manifest.json`
- `../demos/agentic-metadata-poc.json`

In `demo-runtime`, the card requires `MONGODB_URI` and Grove credentials for the full narrative. Without embeddings or vector indexes, the UI shows lexical degraded mode explicitly.

Use:

```bash
npm install
npm run seed
npm run dev
npm run test
```

## Tests

Lightweight validation tests live in `server/src/tests/validation.test.js`:

```bash
npm run test
```

They verify:

- unsupported questions do not produce fake SQL
- invalid columns and joins are rejected
- degraded modes are labeled explicitly
- policy warnings are emitted for sensitive fields
- malformed LLM JSON fails validation

## Known Limitations

- SQL drafts are metadata-grounded starting points, not certified warehouse queries
- The app cannot answer outside the loaded metadata catalog
- Vector search requires Atlas plus the vector indexes
- Local Docker Compose demonstrates lexical degraded retrieval, not full vector search
- Policy enforcement is modeled but auth is not implemented yet

## Background References

- MongoDB GraphRAG with Atlas and LangChain: https://www.mongodb.com/company/blog/graphrag-mongodb-atlas-integrating-knowledge-graphs-with-llms
- MongoDB MCP Server tools: https://www.mongodb.com/docs/mcp-server/tools/
- MongoDB automated embedding preview: https://www.mongodb.com/products/updates/now-in-public-preview-automated-embedding-in-vector-search-in-community-edition/
