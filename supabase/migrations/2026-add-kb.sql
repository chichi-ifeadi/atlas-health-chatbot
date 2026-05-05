CREATE TABLE IF NOT EXISTS kb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  tags text[],
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kb_documents_search_idx ON kb_documents USING GIN (search_vector);

ALTER TABLE kb_documents DISABLE ROW LEVEL SECURITY;
