-- Migration 0004: FieldSurvey Pro Structural Data & Camera Placements

CREATE TABLE IF NOT EXISTS server_rooms (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES site_surveys(id) ON DELETE CASCADE,
    room_identifier TEXT,
    dimensions_width_ft REAL,
    dimensions_length_ft REAL,
    rack_type TEXT,
    available_rack_u INTEGER DEFAULT 0,
    voltage TEXT,
    outlet_type TEXT,
    is_dedicated_circuit INTEGER DEFAULT 0,
    ups_required INTEGER DEFAULT 0,
    cooling_present INTEGER DEFAULT 0,
    dust_level TEXT CHECK(dust_level IN ('Low', 'Moderate', 'High', 'Severe')) DEFAULT 'Low',
    isp_demarc_distance_ft INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS camera_placements (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL REFERENCES site_surveys(id) ON DELETE CASCADE,
    camera_index_label TEXT NOT NULL,
    lighting_conditions TEXT,
    mounting_surface TEXT,
    accessories_required TEXT,
    target_retention_days INTEGER DEFAULT 30,
    resolution_target TEXT DEFAULT '1080p',
    fov_photo_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_server_rooms_survey_id ON server_rooms(survey_id);
CREATE INDEX IF NOT EXISTS idx_camera_placements_survey_id ON camera_placements(survey_id);
