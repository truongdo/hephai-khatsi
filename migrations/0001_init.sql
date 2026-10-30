-- Initial D1 schema (see docs/superpowers/plans/2026-10-30-firestore-to-d1-migration.md).
-- Columns hold every field that is filtered, sorted, joined or checked by
-- authorization; `data` holds the rest of the record as JSON. Row mappers in
-- src/worker/dataApi/rows/ convert between rows and domain types.

CREATE TABLE org_units (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('giao_doan', 'ni_gioi')),
  sort_order INTEGER NOT NULL,
  allows_tang INTEGER NOT NULL,
  allows_ni INTEGER NOT NULL
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,               -- = token ('public', 'retreat_<id>')
  kind TEXT NOT NULL CHECK (kind IN ('filler', 'retreat_registration')),
  retreat_id TEXT,
  org_unit_id TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE members (
  id TEXT PRIMARY KEY,               -- {orgUnitId}_{sanghaType}_{cccd}
  org_unit_id TEXT NOT NULL REFERENCES org_units(id),
  sangha_type TEXT NOT NULL CHECK (sangha_type IN ('tang', 'ni')),
  cccd TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'locked')),
  phone TEXT,                        -- normalized dienThoai (replaces memberPhoneIndex)
  current_temple_id TEXT,
  invite_id TEXT,
  ha_lap_tab_rank TEXT,
  sap_xep_ha_lap TEXT,
  giao_pham_he_phai_rank TEXT,
  giao_pham_he_phai_rank_order INTEGER,
  org_unit_name TEXT,
  tinh_trang TEXT,
  directory_role TEXT,
  directory_auth_uid TEXT,
  locked_at TEXT,
  locked_by TEXT,
  edit_requested_at TEXT,
  edit_requested_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL
);
CREATE UNIQUE INDEX members_identity ON members(org_unit_id, sangha_type, cccd);
CREATE INDEX members_phone ON members(org_unit_id, sangha_type, phone);
CREATE INDEX members_list_updated ON members(sangha_type, org_unit_id, status, updated_at, id);
CREATE INDEX members_list_rank ON members(sangha_type, org_unit_id, giao_pham_he_phai_rank_order, id);
CREATE INDEX members_list_org_name ON members(sangha_type, org_unit_name, id);
CREATE INDEX members_ha_lap ON members(sangha_type, ha_lap_tab_rank, org_unit_id, status, sap_xep_ha_lap, id);
CREATE INDEX members_temple ON members(current_temple_id);
CREATE INDEX members_directory_role ON members(directory_role) WHERE directory_role IS NOT NULL;

CREATE TABLE temples (
  id TEXT PRIMARY KEY,
  org_unit_id TEXT NOT NULL REFERENCES org_units(id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'locked')),
  invite_id TEXT,
  list_city_name TEXT,
  org_unit_name TEXT,
  locked_at TEXT,
  locked_by TEXT,
  edit_requested_at TEXT,
  edit_requested_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL
);
CREATE INDEX temples_list_updated ON temples(org_unit_id, status, updated_at, id);
CREATE INDEX temples_list_city ON temples(org_unit_id, list_city_name, id);
CREATE INDEX temples_list_org_name ON temples(org_unit_name, id);

-- Replaces templeManagerPhoneIndex (a phone can manage several temples).
CREATE TABLE temple_manager_phones (
  temple_id TEXT NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
  org_unit_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  PRIMARY KEY (org_unit_id, phone, temple_id)
);
CREATE INDEX temple_manager_phones_temple ON temple_manager_phones(temple_id);

-- Firestore audit log ids are only unique within their parent (logs are copied
-- with their ids when a member moves), so the key includes the parent.
CREATE TABLE audit_logs (
  parent_type TEXT NOT NULL CHECK (parent_type IN ('members', 'temples')),
  parent_id TEXT NOT NULL,
  id TEXT NOT NULL,
  action TEXT NOT NULL,
  at TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'filler')),
  actor_id TEXT NOT NULL,
  changes TEXT NOT NULL,             -- JSON array of AuditChange
  summary TEXT,
  PRIMARY KEY (parent_type, parent_id, id)
);
CREATE INDEX audit_logs_parent ON audit_logs(parent_type, parent_id, at DESC);

CREATE TABLE retreats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('giao_doan', 'he_phai')),
  org_unit_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'closed')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX retreats_list ON retreats(org_unit_id, status, updated_at, id);

CREATE TABLE retreat_registrations (
  id TEXT PRIMARY KEY,               -- {retreatId}_{memberId}
  retreat_id TEXT NOT NULL REFERENCES retreats(id),
  member_id TEXT NOT NULL,
  org_unit_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  registered_via TEXT NOT NULL CHECK (registered_via IN ('self', 'proxy')),
  registered_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX retreat_registrations_list ON retreat_registrations(retreat_id, created_at DESC, id);
