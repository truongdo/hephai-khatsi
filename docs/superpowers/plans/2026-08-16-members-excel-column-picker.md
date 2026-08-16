# Members Excel Column Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins pick flat member fields for Excel export in a modal, persist the choice per Tăng/Ni in `localStorage`, and write the sheet in fixed catalog order with STT always first.

**Architecture:** A domain catalog maps column ids to headers and cell getters. Persistence is a small helper around `localStorage`. `membersToExcelRows` takes selected ids plus `orgUnitNameById`. The list page opens a Mantine modal instead of exporting immediately; confirm saves ids then calls the existing export use-case.

**Tech Stack:** TypeScript, Vitest, Testing Library, Mantine Modal/Checkbox, Paraglide (`messages/vi.json`), `xlsx`, TanStack Query mutation already on `MembersListPage`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-16-members-excel-column-picker-design.md`
- Workspace: create branch `feat/members-excel-column-picker` from `main` before coding; do not use git worktrees.
- Do not change `listAllForExport`, nested-array export, temples export, or Cypress.
- STT is never optional and is never stored.
- Selected columns emit in **catalog order**, not click order.
- Tang/Ni catalogs and `localStorage` keys are independent.
- Unknown stored ids are dropped; empty after drop → default eight content columns.
- New catalog columns later are not auto-selected.
- Tests: Vitest from `tanstack-app` (`pnpm exec vitest run <file>`). Run `pnpm paraglide` in `tanstack-app` after editing `messages/vi.json`.
- Every task’s requirements include this section.

## File map

| File | Responsibility |
|------|----------------|
| Create `tanstack-app/src/domain/memberExcelColumns.ts` | Catalog defs, defaults, filter by sangha, cell getters |
| Create `tanstack-app/src/domain/memberExcelColumns.test.ts` | Catalog/default/cell tests |
| Create `tanstack-app/src/domain/membersExcelColumnSelection.ts` | `localStorage` load/save/parse |
| Create `tanstack-app/src/domain/membersExcelColumnSelection.test.ts` | Persistence tests |
| Modify `tanstack-app/src/domain/exportMembersExcel.ts` | Rows from selected ids + ctx |
| Modify `tanstack-app/src/domain/exportMembersExcel.test.ts` | Column-aware row tests |
| Modify `tanstack-app/src/use-cases/exportMembersExcel.ts` | Pass `columnIds` and `orgUnitNameById` |
| Modify `tanstack-app/messages/vi.json` | Modal copy + group labels |
| Create `tanstack-app/src/components/admin/MembersExcelColumnsModal.tsx` | Column picker UI |
| Create `tanstack-app/src/components/admin/MembersExcelColumnsModal.test.tsx` | Modal tests |
| Modify `tanstack-app/src/components/admin/MembersListPage.tsx` | Open modal; confirm → persist + export |
| Modify `tanstack-app/src/components/admin/MembersListPage.test.tsx` | Export opens modal; confirm passes ids |

---

### Task 1: Member Excel catalog

**Files:**
- Create: `tanstack-app/src/domain/memberExcelColumns.ts`
- Test: `tanstack-app/src/domain/memberExcelColumns.test.ts`

**Interfaces:**
- Consumes: `Member`, `SanghaType` from `#/domain/types`; `formatAddressDisplay` from `#/domain/address`; `rankLabel` from `#/components/filler/fillerFormOptions`; `m` from `#/paraglide/messages`
- Produces:
  - `export type MembersExcelRowContext = { orgUnitNameById: Record<string, string> }`
  - `export type MemberExcelColumnGroup = 'system' | 'identity' | 'papers' | 'contact' | 'ordination' | 'precepts' | 'ranks' | 'education' | 'other'`
  - `export type MemberExcelColumnDef = { id: string; group: MemberExcelColumnGroup; sangha?: SanghaType; header: () => string; cell: (member: Member, ctx: MembersExcelRowContext) => string | number }`
  - `export const MEMBER_EXCEL_COLUMNS: MemberExcelColumnDef[]`
  - `export function catalogMembersExcelColumns(sanghaType: SanghaType): MemberExcelColumnDef[]`
  - `export function defaultMembersExcelColumnIds(sanghaType: SanghaType): string[]`
  - `export function allowedMembersExcelColumnIdSet(sanghaType: SanghaType): Set<string>`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/memberExcelColumns.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  allowedMembersExcelColumnIdSet,
  catalogMembersExcelColumns,
  defaultMembersExcelColumnIds,
  MEMBER_EXCEL_COLUMNS,
} from '#/domain/memberExcelColumns'

function member(overrides: Partial<Member> & Pick<Member, 'id' | 'sanghaType'>): Member {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

describe('catalogMembersExcelColumns', () => {
  it('omits ni precepts for tang and tang precepts for ni', () => {
    const tangIds = catalogMembersExcelColumns('tang').map((c) => c.id)
    const niIds = catalogMembersExcelColumns('ni').map((c) => c.id)
    expect(tangIds).toContain('gioiTyKheo_ngayGh')
    expect(tangIds).not.toContain('gioiTyKheoNi_ngayGh')
    expect(niIds).toContain('gioiTyKheoNi_ngayGh')
    expect(niIds).not.toContain('gioiTyKheo_ngayGh')
  })
})

describe('defaultMembersExcelColumnIds', () => {
  it('returns the eight legacy content columns for each sangha', () => {
    expect(defaultMembersExcelColumnIds('tang')).toEqual([
      'theDanh',
      'phapDanh',
      'ngaySinh',
      'cccd',
      'cccdNgayCap',
      'cccdNoiCap',
      'gioiTyKheo_ngayGh',
      'hienTuHoc',
    ])
    expect(defaultMembersExcelColumnIds('ni')).toEqual([
      'theDanh',
      'phapDanh',
      'ngaySinh',
      'cccd',
      'cccdNgayCap',
      'cccdNoiCap',
      'gioiTyKheoNi_ngayGh',
      'hienTuHoc',
    ])
  })

  it('defaults are a subset of the sangha catalog', () => {
    for (const sangha of ['tang', 'ni'] as const) {
      const allowed = allowedMembersExcelColumnIdSet(sangha)
      for (const id of defaultMembersExcelColumnIds(sangha)) {
        expect(allowed.has(id)).toBe(true)
      }
    }
  })
})

describe('MEMBER_EXCEL_COLUMNS cells', () => {
  const ctx = { orgUnitNameById: { 'gd-i': 'Giáo đoàn I' } }

  function cell(id: string, mem: Member): string | number {
    const col = MEMBER_EXCEL_COLUMNS.find((c) => c.id === id)
    if (!col) throw new Error(id)
    return col.cell(mem, ctx)
  }

  it('resolves org unit name, formats address, and localizes rank and status', () => {
    const mem = member({
      id: 'm1',
      sanghaType: 'tang',
      noiSinh: { line: '1 A', wardName: 'P.1', cityName: 'HCM' },
      giaoPhamHePhai: { rank: 'ty_kheo', namTienPhong: 2010 },
    })
    expect(cell('orgUnitName', mem)).toBe('Giáo đoàn I')
    expect(cell('noiSinh', mem)).toBe('1 A, P.1, HCM')
    expect(cell('giaoPhamHePhaiRank', mem)).toBe(m.filler_rank_ty_kheo())
    expect(cell('status', mem)).toBe(m.admin_members_status_draft())
  })

  it('falls back to orgUnitId when the name map has no entry', () => {
    const mem = member({ id: 'm1', sanghaType: 'tang', orgUnitId: 'missing' })
    expect(cell('orgUnitName', mem)).toBe('missing')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/memberExcelColumns.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

Create `tanstack-app/src/domain/memberExcelColumns.ts`.

Use `cellStr(value)` → `value ?? ''`. Numbers (`haLap`, `namTienPhong`) → `String(n)` or `''`.

Build precept columns with a helper:

```typescript
function preceptGroup(
  prefix: string,
  sangha: SanghaType,
  preceptHeader: () => string,
  get: (member: Member) => { ngayGh?: string; taiGh?: string; tonHieuGioiDan?: string; ngayHePhai?: string; taiHePhai?: string } | undefined,
): MemberExcelColumnDef[] {
  const sub: Array<{
    key: 'ngayGh' | 'taiGh' | 'tonHieuGioiDan' | 'ngayHePhai' | 'taiHePhai'
    subHeader: () => string
  }> = [
    { key: 'ngayGh', subHeader: () => m.filler_field_precept_ngay_gh() },
    { key: 'taiGh', subHeader: () => m.filler_field_precept_tai_gh() },
    { key: 'tonHieuGioiDan', subHeader: () => m.filler_field_precept_ton_hieu() },
    { key: 'ngayHePhai', subHeader: () => m.filler_field_precept_ngay_hp() },
    { key: 'taiHePhai', subHeader: () => m.filler_field_precept_tai_hp() },
  ]
  return sub.map(({ key, subHeader }) => ({
    id: `${prefix}_${key}`,
    group: 'precepts' as const,
    sangha,
    header: () => `${preceptHeader()} — ${subHeader()}`,
    cell: (member) => cellStr(get(member)?.[key]),
  }))
}
```

Precept prefixes (exact ids):

- tang: `gioiSaDi` ← `member.gioiSaDi`, header `m.filler_field_gioi_sa_di`; `gioiTyKheo` ← `gioiTyKheo`, `m.filler_field_gioi_ty_kheo`
- ni: `gioiSaDiNi`, `gioiThucXoaMaNa` (`m.filler_field_gioi_thuc_xoa`), `gioiTyKheoNi`

Non-precept columns, in this order, then splice precept groups after xuất gia / before phẩm vị:

| id | group | header | cell |
|----|-------|--------|------|
| `orgUnitName` | system | `m.admin_members_col_giao_doan` | `ctx.orgUnitNameById[member.orgUnitId] \|\| member.orgUnitId` |
| `phanDoan` | system | `m.filler_field_phan_doan` | `member.phanDoan` |
| `status` | system | `m.admin_members_col_status` | `member.status === 'locked' ? m.admin_members_status_locked() : m.admin_members_status_draft()` |
| `theDanh` | identity | `m.filler_field_the_danh` | `theDanh` |
| `phapDanh` | identity | `m.filler_field_phap_danh` | `phapDanh` |
| `ngaySinh` | identity | `m.filler_field_ngay_sinh` | `ngaySinh` |
| `noiSinh` | identity | `m.filler_field_noi_sinh` | `formatAddressDisplay(noiSinh)` |
| `nguyenQuan` | identity | `m.filler_field_nguyen_quan` | `nguyenQuan` |
| `danToc` | identity | `m.filler_field_dan_toc` | `danToc` |
| `cccd` | papers | `m.filler_field_cccd` | `cccd` |
| `cccdNgayCap` | papers | `m.filler_field_cccd_ngay_cap` | `cccdMeta?.ngayCap` |
| `cccdNoiCap` | papers | `m.filler_field_cccd_noi_cap` | `cccdMeta?.noiCap` |
| `cntnSo` | papers | `m.filler_field_cntn_so` | `cntn?.so` |
| `cntnNgayCap` | papers | `m.filler_field_cntn_ngay_cap` | `cntn?.ngayCap` |
| `cntnNoiCap` | papers | `m.filler_field_cntn_noi_cap` | `cntn?.noiCap` |
| `dienThoai` | contact | `m.filler_field_dien_thoai` | `dienThoai` |
| `email` | contact | `m.filler_field_email` | `email` |
| `diaChiThuongTru` | contact | `m.filler_field_dia_chi_thuong_tru` | formatted |
| `ngayXuatGia` | ordination | `m.filler_field_ngay_xuat_gia` | `ngayXuatGia` |
| `noiXuatGia` | ordination | `m.filler_field_noi_xuat_gia` | formatted |
| `hienTuHoc` | ordination | `m.filler_field_hien_tu_hoc` | `hienTuHoc` |
| `bonSu` | ordination | `m.filler_field_bon_su` | `bonSu` |
| `hePhaiGoc` | ordination | `m.filler_field_he_phai_goc` | `hePhaiGoc` |
| `giaoDoanGoc` | ordination | `m.filler_field_giao_doan_goc` | `giaoDoanGoc` |
| `haLap` | ordination | `m.filler_field_ha_lap` | number or `''` |
| *(precepts)* | | | |
| `giaoPhamGiaoHoiRank` | ranks | `m.filler_field_gp_giao_hoi` | `rankLabel(giaoPhamGiaoHoi?.rank, member.sanghaType) ?? ''` |
| `giaoPhamGiaoHoiNam` | ranks | `m.filler_field_nam_tien_phong` + GH distinguisher: header `m.filler_field_gp_giao_hoi() + ' — ' + m.filler_field_nam_tien_phong()` | `namTienPhong` |
| `giaoPhamHePhaiRank` | ranks | `m.filler_field_gp_he_phai` | `rankLabel(giaoPhamHePhai?.rank, member.sanghaType) ?? ''` |
| `giaoPhamHePhaiNam` | ranks | `m.filler_field_gp_he_phai() + ' — ' + m.filler_field_nam_tien_phong()` | `namTienPhong` |
| `trinhDoTheHoc` | education | `m.filler_field_trinh_do_the_hoc` | |
| `ngoaiNgu` | education | `m.filler_field_ngoai_ngu` | |
| `trinhDoChuyenMon` | education | `m.filler_field_trinh_do_chuyen_mon` | |
| `capBac` | education | `m.filler_field_cap_bac` | |
| `trinhDoPhatHoc` | education | `m.filler_field_trinh_do_phat_hoc` | |
| `coNgu` | education | `m.filler_field_co_ngu` | |
| `hocViHocHam` | education | `m.filler_field_hoc_vi` | |
| `chucVuDoanThe` | other | `m.filler_field_chuc_vu_doan_the` | |
| `nguyenVong` | other | `m.filler_field_nguyen_vong` | |

Do **not** catalog nested arrays, photos, documents, or ids.

```typescript
export function catalogMembersExcelColumns(sanghaType: SanghaType) {
  return MEMBER_EXCEL_COLUMNS.filter((c) => !c.sangha || c.sangha === sanghaType)
}

export function allowedMembersExcelColumnIdSet(sanghaType: SanghaType) {
  return new Set(catalogMembersExcelColumns(sanghaType).map((c) => c.id))
}

export function defaultMembersExcelColumnIds(sanghaType: SanghaType): string[] {
  const precept = sanghaType === 'tang' ? 'gioiTyKheo_ngayGh' : 'gioiTyKheoNi_ngayGh'
  return ['theDanh', 'phapDanh', 'ngaySinh', 'cccd', 'cccdNgayCap', 'cccdNoiCap', precept, 'hienTuHoc']
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/memberExcelColumns.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/memberExcelColumns.ts tanstack-app/src/domain/memberExcelColumns.test.ts
git commit -m "$(cat <<'EOF'
Add a flat catalog of member Excel export columns.

EOF
)"
```

---

### Task 2: Persist column selection

**Files:**
- Create: `tanstack-app/src/domain/membersExcelColumnSelection.ts`
- Test: `tanstack-app/src/domain/membersExcelColumnSelection.test.ts`

**Interfaces:**
- Consumes: `defaultMembersExcelColumnIds`, `allowedMembersExcelColumnIdSet` from Task 1; `SanghaType`
- Produces:
  - `export function membersExcelColumnsStorageKey(sanghaType: SanghaType): string` → `` `members-excel-columns:${sanghaType}` ``
  - `export function parseStoredMembersExcelColumnIds(raw: string | null, sanghaType: SanghaType): string[]`
  - `export function loadMembersExcelColumnIds(sanghaType: SanghaType, storage?: Pick<Storage, 'getItem'>): string[]`
  - `export function saveMembersExcelColumnIds(sanghaType: SanghaType, ids: string[], storage?: Pick<Storage, 'setItem'>): void`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest'
import { defaultMembersExcelColumnIds } from '#/domain/memberExcelColumns'
import {
  loadMembersExcelColumnIds,
  membersExcelColumnsStorageKey,
  parseStoredMembersExcelColumnIds,
  saveMembersExcelColumnIds,
} from '#/domain/membersExcelColumnSelection'

describe('parseStoredMembersExcelColumnIds', () => {
  it('returns defaults for null, invalid JSON, non-array, and empty after stripping', () => {
    const defaults = defaultMembersExcelColumnIds('tang')
    expect(parseStoredMembersExcelColumnIds(null, 'tang')).toEqual(defaults)
    expect(parseStoredMembersExcelColumnIds('{', 'tang')).toEqual(defaults)
    expect(parseStoredMembersExcelColumnIds('{}', 'tang')).toEqual(defaults)
    expect(parseStoredMembersExcelColumnIds('["not-a-column"]', 'tang')).toEqual(defaults)
  })

  it('keeps known ids in catalog order and drops unknown and ni-only ids on tang', () => {
    expect(
      parseStoredMembersExcelColumnIds(
        JSON.stringify(['hienTuHoc', 'gioiTyKheoNi_ngayGh', 'theDanh', 'nope']),
        'tang',
      ),
    ).toEqual(['theDanh', 'hienTuHoc'])
  })
})

describe('load/save', () => {
  it('round-trips through a Storage mock', () => {
    const store: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    }
    saveMembersExcelColumnIds('ni', ['phapDanh', 'cccd'], storage)
    expect(store[membersExcelColumnsStorageKey('ni')]).toBe(JSON.stringify(['phapDanh', 'cccd']))
    expect(loadMembersExcelColumnIds('ni', storage)).toEqual(['phapDanh', 'cccd'])
  })
})
```

`parseStoredMembersExcelColumnIds` must reorder kept ids to **catalog order** (spec: Excel order is catalog, not stored array order). After save, load may receive click order; parse should still emit catalog order so Excel is stable even if storage is unordered.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/membersExcelColumnSelection.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { SanghaType } from '#/domain/types'
import {
  allowedMembersExcelColumnIdSet,
  catalogMembersExcelColumns,
  defaultMembersExcelColumnIds,
} from '#/domain/memberExcelColumns'

export function membersExcelColumnsStorageKey(sanghaType: SanghaType): string {
  return `members-excel-columns:${sanghaType}`
}

export function parseStoredMembersExcelColumnIds(
  raw: string | null,
  sanghaType: SanghaType,
): string[] {
  const defaults = defaultMembersExcelColumnIds(sanghaType)
  if (raw == null) return defaults
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) {
      return defaults
    }
    const allowed = allowedMembersExcelColumnIdSet(sanghaType)
    const selected = new Set(parsed.filter((id) => allowed.has(id)))
    if (selected.size === 0) return defaults
    return catalogMembersExcelColumns(sanghaType)
      .map((c) => c.id)
      .filter((id) => selected.has(id))
  } catch {
    return defaults
  }
}

export function loadMembersExcelColumnIds(
  sanghaType: SanghaType,
  storage: Pick<Storage, 'getItem'> = globalThis.localStorage,
): string[] {
  return parseStoredMembersExcelColumnIds(storage.getItem(membersExcelColumnsStorageKey(sanghaType)), sanghaType)
}

export function saveMembersExcelColumnIds(
  sanghaType: SanghaType,
  ids: string[],
  storage: Pick<Storage, 'setItem'> = globalThis.localStorage,
): void {
  const allowed = allowedMembersExcelColumnIdSet(sanghaType)
  const selected = new Set(ids.filter((id) => allowed.has(id)))
  const ordered = catalogMembersExcelColumns(sanghaType)
    .map((c) => c.id)
    .filter((id) => selected.has(id))
  storage.setItem(
    membersExcelColumnsStorageKey(sanghaType),
    JSON.stringify(ordered.length > 0 ? ordered : defaultMembersExcelColumnIds(sanghaType)),
  )
}
```

If `localStorage` is missing in SSR, list-page load should only run in the click/open handler (browser). Do not call `load` at module init.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/membersExcelColumnSelection.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/membersExcelColumnSelection.ts tanstack-app/src/domain/membersExcelColumnSelection.test.ts
git commit -m "$(cat <<'EOF'
Persist member Excel column choices in localStorage.

EOF
)"
```

---

### Task 3: Build Excel rows from selected columns

**Files:**
- Modify: `tanstack-app/src/domain/exportMembersExcel.ts`
- Modify: `tanstack-app/src/domain/exportMembersExcel.test.ts`
- Modify: `tanstack-app/src/use-cases/exportMembersExcel.ts`

**Interfaces:**
- Consumes: `catalogMembersExcelColumns`, `MembersExcelRowContext` from Task 1
- Produces:
  - `export function membersToExcelRows(members: Member[], sanghaType: SanghaType, columnIds: string[], ctx: MembersExcelRowContext): MembersExcelCell[][]`
  - `export function downloadMembersExcel(members: Member[], sanghaType: SanghaType, columnIds: string[], ctx: MembersExcelRowContext, options?: { filename?: string; sheetName?: string }): void`
  - Remove `MEMBERS_EXCEL_HEADERS` (replace usages with catalog headers).
  - `ExportMembersExcelInput` adds `columnIds: string[]` and `orgUnitNameById: Record<string, string>`
  - `exportMembersExcel` passes those into `downloadMembersExcel`

- [ ] **Step 1: Write the failing test**

Replace `tanstack-app/src/domain/exportMembersExcel.test.ts` body for `membersToExcelRows` (keep filename tests). Use `defaultMembersExcelColumnIds` and empty ctx `{ orgUnitNameById: {} }`.

```typescript
import { defaultMembersExcelColumnIds } from '#/domain/memberExcelColumns'
import { catalogMembersExcelColumns } from '#/domain/memberExcelColumns'
import { membersToExcelRows, buildMembersExcelFilename } from '#/domain/exportMembersExcel'

const emptyCtx = { orgUnitNameById: {} }

it('puts STT first then selected headers in catalog order', () => {
  const rows = membersToExcelRows([], 'tang', ['hienTuHoc', 'theDanh'], emptyCtx)
  const cols = catalogMembersExcelColumns('tang')
  const theDanh = cols.find((c) => c.id === 'theDanh')!
  const hien = cols.find((c) => c.id === 'hienTuHoc')!
  expect(rows[0]).toEqual(['STT', theDanh.header(), hien.header()])
})

it('maps default tang columns including gioiTyKheo_ngayGh', () => {
  const rows = membersToExcelRows(
    [member({ id: 'm1', sanghaType: 'tang', theDanh: 'Nguyen Van A', phapDanh: 'Thich A', ngaySinh: '1990-05-01', cccd: '001122334455', cccdMeta: { ngayCap: '2015-01-02', noiCap: 'Ha Noi' }, gioiTyKheo: { ngayGh: '2018-06-15' }, gioiTyKheoNi: { ngayGh: '2099-01-01' }, hienTuHoc: 'Tinh xa X' })],
    'tang',
    defaultMembersExcelColumnIds('tang'),
    emptyCtx,
  )
  expect(rows[1]).toEqual([1, 'Nguyen Van A', 'Thich A', '1990-05-01', '001122334455', '2015-01-02', 'Ha Noi', '2018-06-15', 'Tinh xa X'])
})

it('maps ni default precept column from gioiTyKheoNi', () => {
  const rows = membersToExcelRows(
    [member({ id: 'm2', sanghaType: 'ni', gioiTyKheo: { ngayGh: '2010-01-01' }, gioiTyKheoNi: { ngayGh: '2020-08-20' } })],
    'ni',
    defaultMembersExcelColumnIds('ni'),
    emptyCtx,
  )
  expect(rows[1]?.[7]).toBe('2020-08-20')
})

it('ignores unknown ids and sequential STT', () => {
  const rows = membersToExcelRows(
    [
      member({ id: 'm1', sanghaType: 'tang', cccd: '111' }),
      member({ id: 'm2', sanghaType: 'tang', cccd: '222', theDanh: 'Only name' }),
    ],
    'tang',
    ['nope', 'theDanh', 'cccd'],
    emptyCtx,
  )
  expect(rows[1]).toEqual([1, '', '111'])
  expect(rows[2]).toEqual([2, 'Only name', '222'])
})
```

Keep the `member()` fixture from the existing test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/exportMembersExcel.test.ts`

Expected: FAIL (arity / missing args)

- [ ] **Step 3: Write minimal implementation**

```typescript
export function membersToExcelRows(
  members: Member[],
  sanghaType: SanghaType,
  columnIds: string[],
  ctx: MembersExcelRowContext,
): MembersExcelCell[][] {
  const selected = new Set(columnIds)
  const columns = catalogMembersExcelColumns(sanghaType).filter((c) => selected.has(c.id))
  return [
    ['STT', ...columns.map((c) => c.header())],
    ...members.map((member, index) => [
      index + 1,
      ...columns.map((c) => c.cell(member, ctx)),
    ]),
  ]
}

export function downloadMembersExcel(
  members: Member[],
  sanghaType: SanghaType,
  columnIds: string[],
  ctx: MembersExcelRowContext,
  options?: { filename?: string; sheetName?: string },
): void {
  const rows = membersToExcelRows(members, sanghaType, columnIds, ctx)
  // existing xlsx writeFile path unchanged
}
```

Update use-case:

```typescript
export type ExportMembersExcelInput = {
  sanghaType: SanghaType
  orgUnitId?: string
  status?: RecordStatus
  columnIds: string[]
  orgUnitNameById: Record<string, string>
}

downloadMembersExcel(members, input.sanghaType, input.columnIds, {
  orgUnitNameById: input.orgUnitNameById,
})
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd tanstack-app && pnpm exec vitest run src/domain/exportMembersExcel.test.ts src/domain/memberExcelColumns.test.ts`

Expected: PASS. Then `cd tanstack-app && pnpm exec vitest run` and fix any other callers of `membersToExcelRows` / `exportMembersExcel` / `MEMBERS_EXCEL_HEADERS`.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/exportMembersExcel.ts tanstack-app/src/domain/exportMembersExcel.test.ts tanstack-app/src/use-cases/exportMembersExcel.ts
git commit -m "$(cat <<'EOF'
Build member Excel sheets from selected catalog columns.

EOF
)"
```

---

### Task 4: Export columns modal

**Files:**
- Modify: `tanstack-app/messages/vi.json` (insert next to `admin_members_export_excel`)
- Create: `tanstack-app/src/components/admin/MembersExcelColumnsModal.tsx`
- Test: `tanstack-app/src/components/admin/MembersExcelColumnsModal.test.tsx`

**Interfaces:**
- Consumes: `catalogMembersExcelColumns`, `MemberExcelColumnGroup` from Task 1
- Produces:
  - `export type MembersExcelColumnsModalProps = { opened: boolean; onClose: () => void; sanghaType: SanghaType; columnIds: string[]; onColumnIdsChange: (ids: string[]) => void; onConfirm: () => void; confirmLoading?: boolean }`
  - Group label map via `m.admin_members_export_group_*`

Add to `vi.json` (exact strings):

```json
"admin_members_export_columns_title": "Chọn cột xuất Excel",
"admin_members_export_select_all": "Chọn tất cả",
"admin_members_export_deselect": "Bỏ chọn",
"admin_members_export_confirm": "Xuất",
"admin_members_export_group_system": "Hệ thống",
"admin_members_export_group_identity": "Định danh",
"admin_members_export_group_papers": "Giấy tờ",
"admin_members_export_group_contact": "Liên hệ",
"admin_members_export_group_ordination": "Xuất gia",
"admin_members_export_group_precepts": "Thọ giới",
"admin_members_export_group_ranks": "Phẩm vị",
"admin_members_export_group_education": "Học vấn",
"admin_members_export_group_other": "Khác"
```

After editing messages: `cd tanstack-app && pnpm paraglide`

- [ ] **Step 1: Write the failing test**

```typescript
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { MembersExcelColumnsModal } from './MembersExcelColumnsModal'
import { defaultMembersExcelColumnIds } from '#/domain/memberExcelColumns'
import { m } from '#/paraglide/messages'

function renderModal(overrides: Partial<React.ComponentProps<typeof MembersExcelColumnsModal>> = {}) {
  const onColumnIdsChange = vi.fn()
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  render(
    <MantineProvider theme={theme}>
      <MembersExcelColumnsModal
        opened
        onClose={onClose}
        sanghaType="tang"
        columnIds={defaultMembersExcelColumnIds('tang')}
        onColumnIdsChange={onColumnIdsChange}
        onConfirm={onConfirm}
        {...overrides}
      />
    </MantineProvider>,
  )
  return { onColumnIdsChange, onConfirm, onClose }
}

it('shows catalog checkboxes and disables confirm when none selected', async () => {
  const user = userEvent.setup()
  const { onConfirm } = renderModal({ columnIds: [] })
  expect(screen.getByRole('dialog', { name: m.admin_members_export_columns_title() })).toBeTruthy()
  const confirm = screen.getByRole('button', { name: m.admin_members_export_confirm() })
  expect(confirm).toBeDisabled()
  await user.click(confirm)
  expect(onConfirm).not.toHaveBeenCalled()
})

it('hides ni precepts on tang and select-all checks visible columns', async () => {
  const user = userEvent.setup()
  const { onColumnIdsChange } = renderModal({ columnIds: [] })
  expect(screen.queryByRole('checkbox', { name: /Tỳ-kheo-ni/i })).toBeNull()
  await user.click(screen.getByRole('button', { name: m.admin_members_export_select_all() }))
  const ids: string[] = onColumnIdsChange.mock.calls.at(-1)?.[0]
  expect(ids).toContain('gioiTyKheo_ngayGh')
  expect(ids).not.toContain('gioiTyKheoNi_ngayGh')
})
```

If Mantine checkbox accessible name is the header string, use `getByRole('checkbox', { name: m.filler_field_the_danh() })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm paraglide && pnpm exec vitest run src/components/admin/MembersExcelColumnsModal.test.tsx`

Expected: FAIL (component missing) or FAIL (missing message functions) before paraglide.

- [ ] **Step 3: Write minimal implementation**

`MembersExcelColumnsModal.tsx`:

- `Modal` `opened`/`onClose` `title={m.admin_members_export_columns_title()}`
- Buttons: select all → `onColumnIdsChange(catalogMembersExcelColumns(sanghaType).map(c => c.id))`; deselect → `onColumnIdsChange([])`
- Group columns with `catalogMembersExcelColumns(sanghaType)` reduced by `group` in catalog order of first appearance: `system`, `identity`, `papers`, `contact`, `ordination`, `precepts`, `ranks`, `education`, `other`. Skip empty groups.
- Each group: `Text fw={600}` with `m.admin_members_export_group_system()` etc.
- `Checkbox` per column: `checked={columnIds.includes(id)}`; toggle adds/removes id (parent may leave order messy; confirm path will parse to catalog order).
- Footer: `Button` confirm `disabled={columnIds.length === 0 || confirmLoading}` `loading={confirmLoading}` `onClick={onConfirm}` label `m.admin_members_export_confirm()`

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersExcelColumnsModal.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/messages/vi.json tanstack-app/src/components/admin/MembersExcelColumnsModal.tsx tanstack-app/src/components/admin/MembersExcelColumnsModal.test.tsx
git commit -m "$(cat <<'EOF'
Add a modal for choosing member Excel export columns.

EOF
)"
```

If paraglide generated files are gitignored, do not commit them.

---

### Task 5: Wire list page export flow

**Files:**
- Modify: `tanstack-app/src/components/admin/MembersListPage.tsx`
- Modify: `tanstack-app/src/components/admin/MembersListPage.test.tsx`

**Interfaces:**
- Consumes: modal from Task 4; `loadMembersExcelColumnIds` / `saveMembersExcelColumnIds` from Task 2; `exportMembersExcel` from Task 3 (`columnIds`, `orgUnitNameById`)
- Produces: toolbar “Xuất Excel” opens modal; confirm persists and mutates

- [ ] **Step 1: Write the failing test**

In `MembersListPage.test.tsx` add:

```typescript
const exportMembersExcelMock = vi.fn(async () => {})

vi.mock('#/use-cases/exportMembersExcel', () => ({
  exportMembersExcel: (...args: unknown[]) => exportMembersExcelMock(...args),
}))
```

Place the mock with the other `vi.mock` calls (hoisted). `beforeEach`: `exportMembersExcelMock.mockClear()`; `localStorage.clear()`.

```typescript
it('opens column modal on export and exports selected columns on confirm', async () => {
  const user = userEvent.setup()
  renderPage()
  await user.click(screen.getByRole('button', { name: 'Xuất Excel' }))
  expect(exportMembersExcelMock).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog', { name: 'Chọn cột xuất Excel' })
  await user.click(within(dialog).getByRole('button', { name: 'Xuất' }))
  await waitFor(() => expect(exportMembersExcelMock).toHaveBeenCalled())
  const input = exportMembersExcelMock.mock.calls[0]?.[0] as {
    columnIds: string[]
    orgUnitNameById: Record<string, string>
    sanghaType: string
  }
  expect(input.sanghaType).toBe('tang')
  expect(input.columnIds[0]).toBe('theDanh')
  expect(input.orgUnitNameById['gd-i']).toBe('Giáo đoàn I')
})
```

`renderPage` is the existing helper in this file (keep using it). If the helper has another name, use the same `render` wrapper already in the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersListPage.test.tsx`

Expected: FAIL (export still fires immediately / no dialog)

- [ ] **Step 3: Write minimal implementation**

In `MembersListPage`:

```typescript
const [exportOpen, setExportOpen] = useState(false)
const [exportColumnIds, setExportColumnIds] = useState<string[]>([])

const exportMutation = useMutation({
  mutationFn: () =>
    exportMembersExcel({
      sanghaType,
      orgUnitId: scopedOrgUnitId,
      status: serverStatusFilter,
      columnIds: exportColumnIds,
      orgUnitNameById,
    }),
})
```

Export button: `onClick={() => { setExportColumnIds(loadMembersExcelColumnIds(sanghaType)); setExportOpen(true) }}` — do **not** call `mutate` here.

Render:

```tsx
<MembersExcelColumnsModal
  opened={exportOpen}
  onClose={() => setExportOpen(false)}
  sanghaType={sanghaType}
  columnIds={exportColumnIds}
  onColumnIdsChange={setExportColumnIds}
  confirmLoading={exportMutation.isPending}
  onConfirm={() => {
    if (exportColumnIds.length === 0) return
    saveMembersExcelColumnIds(sanghaType, exportColumnIds)
    setExportOpen(false)
    exportMutation.mutate()
  }}
/>
```

`orgUnitNameById` is already built on this page; reuse it.

React state vs mutation closure: set state then `mutate()` in the same handler can see stale `exportColumnIds` if confirm used a local copy. Confirm should pass ids explicitly:

Change mutation to:

```typescript
mutationFn: (columnIds: string[]) =>
  exportMembersExcel({ ..., columnIds, orgUnitNameById })
```

`onConfirm`: `save...`; `setExportOpen(false)`; `exportMutation.mutate(exportColumnIds)`.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `cd tanstack-app && pnpm exec vitest run src/components/admin/MembersListPage.test.tsx src/components/admin/MembersExcelColumnsModal.test.tsx src/domain/exportMembersExcel.test.ts src/domain/memberExcelColumns.test.ts src/domain/membersExcelColumnSelection.test.ts`

Expected: PASS

Then: `cd tanstack-app && pnpm test`

Expected: PASS (full Vitest suite)

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/components/admin/MembersListPage.tsx tanstack-app/src/components/admin/MembersListPage.test.tsx
git commit -m "$(cat <<'EOF'
Open a column picker before exporting members to Excel.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Modal before download | 4, 5 |
| Catalog groups and ids | 1 |
| STT always first | 3 |
| Catalog order, not click order | 2 parse + 3 filter |
| Tang/Ni precept filter | 1, 4 |
| Defaults = eight legacy columns | 1 |
| `localStorage` keys per sangha | 2 |
| Invalid/empty storage → defaults | 2 |
| New columns not auto-selected | 1 defaults + 2 parse (only stored ids) |
| Address format / rank / org name | 1 |
| No `listAllForExport` change | 3 use-case still lists then maps |
| Vitest, no Cypress | all |
| Filename unchanged | 3 keeps `buildMembersExcelFilename` |

No TBD placeholders. Signatures: `columnIds: string[]` and `MembersExcelRowContext` are consistent across tasks 1–5.
