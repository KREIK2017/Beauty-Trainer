ALTER TABLE accounts ADD COLUMN last_login_at TEXT;
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY CHECK (id=1),
  registration_open INTEGER NOT NULL CHECK (registration_open IN (0,1)),
  updated_at TEXT NOT NULL
);
INSERT INTO app_settings VALUES (1,1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));
