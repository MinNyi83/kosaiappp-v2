-- Migration 0005: Enterprise Project Engineering Matrix Schema

-- Enums / Text constraints for pipeline and cable specs
CREATE TABLE IF NOT EXISTS core_projects (
    project_id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    site_physical_address TEXT NOT NULL,
    current_stage TEXT CHECK(current_stage IN ('intake', 'survey_scheduled', 'survey_complete', 'proposal_draft', 'sent_to_client', 'negotiation', 'approved_signed', 'converted_to_job', 'rejected')) DEFAULT 'intake',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS target_camera_locations (
    location_id TEXT PRIMARY KEY,
    survey_id TEXT REFERENCES site_surveys(id) ON DELETE CASCADE,
    device_tag_id TEXT NOT NULL,
    target_resolution_megapixels REAL NOT NULL DEFAULT 5.0,
    estimated_cable_run_meters REAL CHECK (estimated_cable_run_meters <= 200.0),
    cable_spec TEXT CHECK(cable_spec IN ('cat6_plenum', 'cat6a_shielded', 'fiber_multimode')) DEFAULT 'cat6_plenum',
    required_mounting_accessory TEXT,
    environmental_lighting_notes TEXT,
    needs_override INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cost_quotations_enterprise (
    quotation_id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES core_projects(project_id) ON DELETE CASCADE,
    revision_number INTEGER DEFAULT 1 NOT NULL,
    raw_hardware_cost_basis REAL NOT NULL DEFAULT 0.0,
    applied_margin_multiplier REAL DEFAULT 1.35 NOT NULL,
    estimated_labor_hours REAL NOT NULL DEFAULT 16.0,
    blended_labor_rate_hourly REAL DEFAULT 95.00 NOT NULL,
    grand_total_value REAL NOT NULL DEFAULT 0.0,
    is_active_version INTEGER DEFAULT 1,
    client_visible_portal_token TEXT UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_core_projects_stage ON core_projects(current_stage);
CREATE INDEX IF NOT EXISTS idx_target_camera_locations_survey ON target_camera_locations(survey_id);
