-- Add survey_type to site_surveys and valid_days to quotations
ALTER TABLE site_surveys ADD COLUMN survey_type TEXT CHECK(survey_type IN ('CCTV', 'Networking', 'WiFi', 'NAS', 'Access Control', 'General')) DEFAULT 'CCTV';
ALTER TABLE quotations ADD COLUMN valid_days INTEGER DEFAULT 14;
