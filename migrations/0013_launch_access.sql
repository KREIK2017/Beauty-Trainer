ALTER TABLE app_settings ADD COLUMN invitation_code_hash TEXT;
ALTER TABLE accounts ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1));
