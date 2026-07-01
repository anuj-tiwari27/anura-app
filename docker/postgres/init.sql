-- Runs once when the Postgres volume is first initialized.
-- Enables pgvector so the Embeddings / Judgements tables can store and
-- similarity-search embedding vectors ( <=> cosine distance operator ).
CREATE EXTENSION IF NOT EXISTS vector;

-- Trigram + unaccent help fuzzy text search before OpenSearch is introduced.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
