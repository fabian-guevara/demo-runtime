# Demo Script

## 1. The customer problem

Business users ask natural-language questions, but the hard part is not only generating SQL. The hard part is discovering the right tables, understanding how those tables connect, and explaining why the plan is trustworthy.

## 2. The MongoDB angle

MongoDB is the application-facing retrieval layer. It stores table metadata, relationship metadata, optional vector embeddings, query runs, and operational context that an AI agent can reason over before it ever writes SQL.

## 3. Ask the sample question

Use:

`How many high-value customers had billing issues after a plan migration in the last 30 days?`

## 4. Show retrieved tables

Point to the retrieved `table_nodes`:

- `customers`
- `customer_value_segments`
- `plan_migrations`
- `billing_events`

Explain that the agent is retrieving metadata, not warehouse rows.

## 5. Show retrieved edges

Point to the relationship edges:

- `customers.customer_id -> customer_value_segments.customer_id`
- `customers.customer_id -> plan_migrations.customer_id`
- `customers.customer_id -> billing_events.customer_id`

Explain that MongoDB is holding the graph-like relationship context the agent needs.

## 6. Show generated SQL

Open the SQL terminal and explain that the agent now has enough context to generate a warehouse query draft with explicit joins and filters.

## 7. Show the MongoDB alternative model

Highlight the `customer_activity_summary` document shape and explain that this is how the workload could be remodeled for repeated operational AI use cases.

## 8. Close with why this matters

- better retrieval than pure text search
- graph-like relationship reasoning
- vector + metadata + operational context in one platform
- foundation for real-time AI apps
