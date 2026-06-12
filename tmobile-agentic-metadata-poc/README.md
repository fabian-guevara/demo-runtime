# Agentic Metadata Planner

`tmobile-agentic-metadata-poc` is a MongoDB-powered POC for the agentic retrieval and query-planning layer that often sits in front of a warehouse or lakehouse. The demo is intentionally aimed at schema discovery, relationship reasoning, and query-plan generation rather than generic document RAG.

This demo does not position MongoDB as a drop-in replacement for Databricks or Redshift analytics. Instead, it demonstrates MongoDB as the application-facing agentic retrieval layer that can store schema metadata, relationship metadata, vector embeddings, query runs, and operational context. The core use case is helping an AI agent discover the right data assets, understand relationships, generate query plans, and optionally connect that reasoning to real-time operational data.

## What This POC Demonstrates

- MongoDB storing table metadata as `table_nodes`
- MongoDB storing join relationships as `table_edges`
- Voyage AI embeddings for metadata search when `VOYAGE_API_KEY` is present
- Atlas Vector Search over metadata and relationship embeddings when available
- Local lexical fallback retrieval when Atlas Vector Search is unavailable
- Graph-like traversal across relationship edges to build join paths
- **GraphRAG** on Atlas using the LangChain `MongoDBGraphStore` entity schema and `$graphLookup` traversal (Node.js port; official Python package is `langchain-mongodb`)
- Deterministic query planning in mock mode
- Optional real LLM generation for SQL and explanation when `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is present
- Persisted `query_runs` for demo traceability

## How It Maps To The Customer Flow

1. A business user asks a natural-language question.
2. The app retrieves relevant `table_nodes`.
3. The app retrieves relevant `table_edges`.
4. The GraphRAG step extracts entity names and traverses `metadata_knowledge_graph` with `$graphLookup`.
5. The planner selects tables, joins, filters, and metrics.
6. The generator produces SQL and a MongoDB remodeling alternative.
7. The run is persisted in `query_runs`.

## What MongoDB Is Doing

- Storing schema metadata, sample fields, sample rows, and tags
- Storing relationship metadata and join confidence
- Storing optional Voyage embeddings
- Serving vector retrieval when Atlas Vector Search is available
- Serving lexical fallback retrieval when local MongoDB is used
- Persisting prior query runs and operational demo telemetry

## What MongoDB Is Not Doing

- MongoDB is not replacing Databricks, Redshift, or the warehouse execution engine
- MongoDB is not automatically inferring the customer schema from nothing
- MongoDB is not running the final SQL against the warehouse in this demo

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
    sqlGenerator.js
    llm.js
    routes.js
/client
  /src
    App.jsx
    api.js
    /components
/docker-compose.yml
/README.md
/.env.example
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

3. Copy `.env.example` to `.env` and set `MONGODB_URI`.

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

- `MONGODB_URI`
- `MONGODB_DB`
- `VOYAGE_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

## Mock And Real LLM Modes

- `Mock LLM mode`: active when no `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` exists. Query planning and SQL generation are deterministic.
- `Real LLM mode`: active when `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` exists. The app uses retrieved tables, edges, and the deterministic plan as context for model-generated SQL and explanation.

The AWS variables are included for customer environment alignment, but this code path currently activates real LLM mode through OpenAI or Anthropic keys.

## Voyage Embeddings

- If `VOYAGE_API_KEY` is present, seed will generate embeddings for `table_nodes` and `table_edges`.
- The default embedding model is `voyage-3.5-lite`.
- If Voyage is unavailable or Atlas Vector Search is not configured, the app falls back to lexical retrieval.

## Atlas Vector Search Indexes

Index JSON definitions live in:

- `server/src/vectorIndexes/table_nodes_vector_index.json`
- `server/src/vectorIndexes/table_edges_vector_index.json`

Create those indexes in Atlas Search / Vector Search if you want real vector retrieval. The index expects `embedding` vectors with 1024 dimensions.

## Running On demo-runtime

This repo includes a `.demo` folder and a runtime manifest entry:

- `.demo/manifest.json`
- `../demos/agentic-metadata-poc.json`

In `demo-runtime`, the card only requires `MONGODB_URI` to launch because the demo can run in lexical retrieval mode and mock LLM mode.

## Known Limitations

- The planner is intentionally deterministic for the sample prompts
- The SQL is not executed against a live warehouse
- Atlas Vector Search requires Atlas plus the vector indexes
- The local Docker Compose path demonstrates lexical fallback, not full vector search
- The AWS variables are not currently wired to a Bedrock adapter in this repo

## Background References

- MongoDB GraphRAG with Atlas and LangChain: https://www.mongodb.com/company/blog/graphrag-mongodb-atlas-integrating-knowledge-graphs-with-llms
- MongoDB MCP Server tools: https://www.mongodb.com/docs/mcp-server/tools/
- MongoDB automated embedding preview: https://www.mongodb.com/products/updates/now-in-public-preview-automated-embedding-in-vector-search-in-community-edition/
- LangChain MongoDB Atlas integration: https://docs.langchain.com/oss/javascript/integrations/vectorstores/mongodb_atlas
