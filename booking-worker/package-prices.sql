ALTER TABLE settings ADD COLUMN two_hour_paise INTEGER NOT NULL DEFAULT 35000;
ALTER TABLE settings ADD COLUMN three_hour_paise INTEGER NOT NULL DEFAULT 50000;
UPDATE settings SET hourly_paise=20000 WHERE id=1 AND hourly_paise=0;
