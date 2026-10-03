-- Free place discovery preserves the original Burger King category and entries.
INSERT INTO place_categories(key,name) VALUES ('place','Lieu libre') ON CONFLICT(key) DO NOTHING;
