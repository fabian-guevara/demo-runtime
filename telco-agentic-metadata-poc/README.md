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
- Grove as the LLM gateway when `REQUIRE_LLM=true`
- Governance visibility for classification, PII, owners, and allowed roles
- Persisted `query_runs` for demo traceability

## Runtime Modes

### LLM

- Provider: Grove
- `debug.llmMode: grove` when Grove is required and healthy
- `debug.llmMode: unavailable` when `REQUIRE_LLM=false`
- `debug.llmMode: grove_degraded` when Grove is configured but metadata fallback or warnings were used
- Malformed Grove JSON returns `LLM_VALIDATION_FAILED` after one retry when `REQUIRE_LLM=true`

### Embeddings

- `debug.embeddingMode: voyage | atlas | unavailable`
- Voyage platform keys use `https://api.voyageai.com/v1/embeddings`
- Atlas model keys (`al-...`) use `https://ai.mongodb.com/v1/embeddings`
- Default model: `voyage-4`

### Retrieval

- `retrieval.mode: vector | lexical_degraded | unavailable`
- Lexical degraded mode is explicit in the API and UI; it is not equivalent to vector search
- If `REQUIRE_VECTOR_SEARCH=true`, the API fails with `VECTOR_SEARCH_UNAVAILABLE`
- If `REQUIRE_EMBEDDINGS=true`, the API fails with `EMBEDDINGS_UNAVAILABLE`

### Graph

- `graph.mode: graph_lookup | degraded | unavailable`
- Uses MongoDB `$graphLookup` over seeded BusinessConcept, Metric, Domain, Owner, and PolicyClassification nodes

## `/api/query` Response Shape

```json
{
  "answer": "...",
  "retrieval": { "mode": "vector|lexical_degraded|unavailable", "results": [], "warnings": [] },
  "graph": { "mode": "graph_lookup|degraded|unavailable", "paths": [], "evidence": [] },
  "plan": {
    "isValid": true,
    "tables": [],
    "columns": [],
    "joins": [],
    "filters": [],
    "metrics": [],
    "assumptions": [],
    "confidence": 0.0,
    "validationErrors": [],
    "validationWarnings": []
  },
  "sql": { "status": "generated|not_generated|validation_failed", "text": "...", "warnings": [] },
  "mongodbAlternative": { "summary": "...", "collections": [], "pipelineSketch": [] },
  "governance": { "policyWarnings": [], "sensitiveFields": [] },
  "debug": {
    "timings": {},
    "llmMode": "...",
    "embeddingMode": "...",
    "retrievalMode": "...",
    "graphMode": "...",
    "llmWarnings": [],
    "planSource": "metadata|grove"
  }
}
```

Invalid plans never generate SQL. The API returns `sql.status = "validation_failed"`.

## Environment Variables

### Required for demo runtime

- `MONGODB_URI`
- `GROVE_API_KEY` when `REQUIRE_LLM=true`

### Optional

- `MONGODB_DB_NAME` default `agentic_metadata_demo`
- `GROVE_MODEL` default `gpt-5.5`
- `GROVE_BASE_URL` Grove responses endpoint
- `VOYAGE_API_KEY`
- `EMBEDDING_MODEL` default `voyage-4`
- `QUERY_LIMIT_DEFAULT` default `100`

### Feature flags

- `REQUIRE_VECTOR_SEARCH=false`
- `REQUIRE_EMBEDDINGS=false`
- `REQUIRE_LLM=false`
- `ENFORCE_POLICY=false`

## Setup

```bash
npm install
npm run seed
npm run dev
npm run test
```

- API: `http://127.0.0.1:4002`
- UI: `http://127.0.0.1:5177`

Local MongoDB:

```bash
docker compose up -d
MONGODB_URI=mongodb://127.0.0.1:27017/?directConnection=true npm run seed
```

## Supported vs Unsupported Prompts

Supported:

- Which tables help analyze churn risk after plan migration?
- How do I join billing disputes to high-value customers?
- Which fields should I use to analyze network usage by customer segment?
- What data is needed to investigate support cases after a plan change?

Unsupported examples must return clear limitations, not fake SQL:

- Show me customer credit card numbers.
- Predict churn for every customer now.
- Query a warehouse table that is not in the metadata catalog.

## What MongoDB Is Not Doing

- Replacing Databricks, Redshift, or the warehouse execution engine
- Running final SQL against the warehouse in this demo
- Returning production-certified SQL
- Answering questions outside the loaded metadata catalog

## Tests

`server/src/tests/validation.test.js` verifies:

- unsupported questions do not generate SQL
- invalid columns and joins are rejected
- lexical degraded mode is labeled explicitly
- policy warnings are emitted for sensitive fields
- malformed LLM JSON fails validation
- generated SQL never uses `SELECT *`

## Atlas Vector Search Indexes

- `server/src/vectorIndexes/table_nodes_vector_index.json`
- `server/src/vectorIndexes/table_edges_vector_index.json`

Indexes expect 1024-dimension embeddings.
