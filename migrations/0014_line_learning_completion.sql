CREATE TABLE flashcard_reviews (
  user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK(rating IN ('again','hard','good','easy')),
  reviewed_at TEXT NOT NULL,
  PRIMARY KEY(user_id,product_id)
);

CREATE INDEX idx_flashcard_reviews_user ON flashcard_reviews(user_id,reviewed_at);

ALTER TABLE quiz_sessions ADD COLUMN mode TEXT;
ALTER TABLE quiz_sessions ADD COLUMN difficulty TEXT;
ALTER TABLE quiz_sessions ADD COLUMN line_id TEXT;
ALTER TABLE quiz_sessions ADD COLUMN total_questions INTEGER;
ALTER TABLE quiz_sessions ADD COLUMN completed_at TEXT;
ALTER TABLE quiz_sessions ADD COLUMN passed INTEGER CHECK(passed IN (0,1));

CREATE INDEX idx_quiz_sessions_line_completion
  ON quiz_sessions(user_id,line_id,difficulty,passed,completed_at);
