DELETE FROM auth_attempts;
DELETE FROM auth_sessions;
UPDATE app_settings
SET registration_open = 1,
    invitation_code_hash = NULL;
UPDATE accounts SET must_change_password = 0;
