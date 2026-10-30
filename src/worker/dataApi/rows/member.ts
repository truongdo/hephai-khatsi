import type { MemberTinhTrang } from '#/domain/memberTinhTrang'
import { normalizeVnPhone } from '#/domain/normalize'
import type { Member, RecordStatus, SanghaType } from '#/domain/types'
import {
  fromDataColumn,
  presentFields,
  toColumn,
  toDataColumn,
} from './rowValues'

export type MemberRow = {
  id: string
  org_unit_id: string
  sangha_type: SanghaType
  cccd: string
  status: RecordStatus
  /** Derived: normalized `dienThoai` (the source stays in `data`). */
  phone: string | null
  current_temple_id: string | null
  invite_id: string | null
  ha_lap_tab_rank: string | null
  sap_xep_ha_lap: string | null
  /** Derived: `giaoPhamHePhai.rank` (the source stays in `data`). */
  giao_pham_he_phai_rank: string | null
  giao_pham_he_phai_rank_order: number | null
  org_unit_name: string | null
  tinh_trang: MemberTinhTrang | null
  directory_role: NonNullable<Member['directoryRole']> | null
  directory_auth_uid: string | null
  locked_at: string | null
  locked_by: string | null
  edit_requested_at: string | null
  edit_requested_by: string | null
  created_at: string
  updated_at: string
  data: string
}

type MemberColumnFields =
  | 'id'
  | 'orgUnitId'
  | 'sanghaType'
  | 'cccd'
  | 'status'
  | 'currentTempleId'
  | 'inviteId'
  | 'haLapTabRank'
  | 'sapXepHaLap'
  | 'giaoPhamHePhaiRankOrder'
  | 'orgUnitName'
  | 'tinhTrang'
  | 'directoryRole'
  | 'directoryAuthUid'
  | 'lockedAt'
  | 'lockedBy'
  | 'editRequestedAt'
  | 'editRequestedBy'
  | 'createdAt'
  | 'updatedAt'

type MemberData = Omit<Member, MemberColumnFields>

/** Same rule as the Firestore phone index: an invalid phone is not indexed. */
function phoneColumn(dienThoai: string | undefined): string | null {
  if (!dienThoai) return null
  try {
    return normalizeVnPhone(dienThoai)
  } catch {
    return null
  }
}

/** `version` is left to the write handlers (the column defaults to 1). */
export function memberToRow(member: Member): MemberRow {
  const {
    id,
    orgUnitId,
    sanghaType,
    cccd,
    status,
    currentTempleId,
    inviteId,
    haLapTabRank,
    sapXepHaLap,
    giaoPhamHePhaiRankOrder,
    orgUnitName,
    tinhTrang,
    directoryRole,
    directoryAuthUid,
    lockedAt,
    lockedBy,
    editRequestedAt,
    editRequestedBy,
    createdAt,
    updatedAt,
    ...data
  } = member
  return {
    id,
    org_unit_id: orgUnitId,
    sangha_type: sanghaType,
    cccd,
    status,
    phone: phoneColumn(data.dienThoai),
    current_temple_id: currentTempleId,
    invite_id: inviteId,
    ha_lap_tab_rank: toColumn(haLapTabRank),
    sap_xep_ha_lap: toColumn(sapXepHaLap),
    giao_pham_he_phai_rank: toColumn(data.giaoPhamHePhai?.rank),
    giao_pham_he_phai_rank_order: toColumn(giaoPhamHePhaiRankOrder),
    org_unit_name: toColumn(orgUnitName),
    tinh_trang: toColumn(tinhTrang),
    directory_role: toColumn(directoryRole),
    directory_auth_uid: toColumn(directoryAuthUid),
    locked_at: lockedAt,
    locked_by: lockedBy,
    edit_requested_at: editRequestedAt,
    edit_requested_by: editRequestedBy,
    created_at: createdAt,
    updated_at: updatedAt,
    data: toDataColumn(data satisfies MemberData),
  }
}

/**
 * `tinhTrang: null` (cleared) reads back as absent; callers already treat
 * both the same (`member.tinhTrang ?? null`).
 */
export function memberFromRow(row: MemberRow): Member {
  return {
    ...fromDataColumn<MemberData>(row.data),
    id: row.id,
    orgUnitId: row.org_unit_id,
    sanghaType: row.sangha_type,
    cccd: row.cccd,
    status: row.status,
    currentTempleId: row.current_temple_id,
    inviteId: row.invite_id,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    editRequestedAt: row.edit_requested_at,
    editRequestedBy: row.edit_requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...presentFields({
      haLapTabRank: row.ha_lap_tab_rank,
      sapXepHaLap: row.sap_xep_ha_lap,
      giaoPhamHePhaiRankOrder: row.giao_pham_he_phai_rank_order,
      orgUnitName: row.org_unit_name,
      tinhTrang: row.tinh_trang,
      directoryRole: row.directory_role,
      directoryAuthUid: row.directory_auth_uid,
    }),
  }
}
