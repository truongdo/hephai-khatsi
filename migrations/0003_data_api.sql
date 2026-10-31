-- Phase 3 of the D1 migration: the Worker data API (src/worker/dataApi/).

-- Write batches guard their main row with `version` (or with an insert that
-- must not hit an existing row); a guard statement inserts here when the
-- previous statement changed no row, and the trigger aborts the whole batch
-- with a message the Worker maps to 409.
CREATE TABLE write_conflicts (x INTEGER);
CREATE TRIGGER write_conflicts_abort BEFORE INSERT ON write_conflicts
BEGIN
  SELECT RAISE(ABORT, 'WRITE_CONFLICT');
END;

-- Retreats are edited and registrations reviewed with the same guard.
ALTER TABLE retreats ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE retreat_registrations ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- List shapes without an org unit filter (hệ phái scope) and the sort keys
-- 0001 did not cover. Lists skip rows whose sort column is NULL, like a
-- Firestore orderBy on a missing field.
CREATE INDEX members_sangha_updated ON members(sangha_type, updated_at, id);
CREATE INDEX members_org_updated ON members(sangha_type, org_unit_id, updated_at, id);
CREATE INDEX members_sangha_status ON members(sangha_type, status, updated_at, id);
CREATE INDEX members_sangha_rank ON members(sangha_type, giao_pham_he_phai_rank_order, id);
CREATE INDEX members_org_status ON members(sangha_type, org_unit_id, status, id);
CREATE INDEX members_org_org_name ON members(sangha_type, org_unit_id, org_unit_name, id);
CREATE INDEX members_ha_lap_all ON members(sangha_type, ha_lap_tab_rank, sap_xep_ha_lap, id);

-- Stats: counts per org unit / sangha / giáo phẩm rank.
CREATE INDEX members_stats ON members(org_unit_id, sangha_type, giao_pham_he_phai_rank);
CREATE INDEX members_stats_all ON members(sangha_type, giao_pham_he_phai_rank);

CREATE INDEX temples_updated ON temples(updated_at, id);
CREATE INDEX temples_org_updated ON temples(org_unit_id, updated_at, id);
CREATE INDEX temples_status_updated ON temples(status, updated_at, id);
CREATE INDEX temples_city ON temples(list_city_name, id);
CREATE INDEX temples_org_org_name ON temples(org_unit_id, org_unit_name, id);

CREATE INDEX retreats_updated ON retreats(updated_at, id);
CREATE INDEX retreats_org_updated ON retreats(org_unit_id, updated_at, id);
CREATE INDEX retreats_status_updated ON retreats(status, updated_at, id);
