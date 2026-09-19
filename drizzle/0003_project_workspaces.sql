ALTER TABLE atlas_projects ADD COLUMN workspace text NOT NULL DEFAULT 'field-map' CHECK (workspace IN ('field-map','urg-2026'));
UPDATE atlas_projects SET workspace='urg-2026' WHERE lower(trim(name))='urg-2026';
