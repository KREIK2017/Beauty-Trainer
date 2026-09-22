CREATE TABLE account_learning_access (
  user_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  all_materials INTEGER NOT NULL CHECK (all_materials IN (0,1)),
  brand_ids TEXT NOT NULL,
  line_ids TEXT NOT NULL,
  revision TEXT NOT NULL
);
