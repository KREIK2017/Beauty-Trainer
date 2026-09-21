-- Only used by db:e2e, never by production seed/deployment.
INSERT OR IGNORE INTO quiz_sessions (id,user_id,questions,created_at)
SELECT 'e2e-legacy-session','local','[]','2026-01-01T12:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id='owner');
INSERT OR IGNORE INTO quiz_history (id,user_id,session_id,question_id,product_id,line_id,selected_answer,correct_answer,correct,xp,created_at)
SELECT 'e2e-legacy-history','local','e2e-legacy-session','legacy',NULL,NULL,'answer','answer',1,10,'2026-01-01T12:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id='owner');
INSERT OR IGNORE INTO user_progress (user_id,entity_type,entity_id,correct_answers,incorrect_answers,mastery_score,last_reviewed_at,next_review_at)
SELECT 'local','line','curl-passion',1,0,15,'2026-01-01T12:00:00.000Z','2026-01-02T12:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE id='owner');
DELETE FROM auth_attempts;
