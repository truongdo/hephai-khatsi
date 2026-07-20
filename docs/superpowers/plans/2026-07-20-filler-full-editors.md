# Filler Full Editors (Member + Temple) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship full paper-parity sectioned editors on `/f/$token/edit/member` and `/f/$token/edit/temple` with sticky **Lưu** wired to `saveMemberDraft` / `saveTempleDraft` (client). No photo upload.

**Architecture:** Extend `FillerEditorShell` with Save. Shared `FormSection` / `RepeatableFieldset` / `PreceptFields`. `TempleEditorForm` and `MemberEditorForm` own draft state and call domain use-cases. Routes pass token, identity search params, and loaded records. Query keys for member/temple detail under `fillerKeys`.

**Tech Stack:** React 19, Mantine 9, TanStack Router + Query, Paraglide, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-20-filler-full-editors-design.md` (parent UI: `2026-07-19-filler-forms-ui-design.md`)

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/filler-full-editors` from `main` (Task 0)
- Call `saveMemberDraft` / `saveTempleDraft` from the client — **do not** add `createServerFn`
- **Do not** implement member photo upload
- Sticky Save hidden when `status === 'view'`; disabled while pending
- Content column remains ~760px parchment (existing `FillerPageFrame`)
- Prefer Vitest; no new Cypress in this plan
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | Section/field/Save/array i18n |
| `tanstack-app/src/components/filler/fillerFormOptions.ts` | Rank / đặc điểm / hạng mục options |
| `tanstack-app/src/components/filler/FormSection.tsx` | Section heading + helper |
| `tanstack-app/src/components/filler/RepeatableFieldset.tsx` | Add/remove rows |
| `tanstack-app/src/components/filler/PreceptFields.tsx` | Shared precept inputs |
| `tanstack-app/src/components/filler/FillerEditorShell.tsx` | Sticky bar + Save |
| `tanstack-app/src/components/filler/TempleEditorForm.tsx` | Full temple form + save |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Full member form + save |
| `tanstack-app/src/query/fillerKeys.ts` | Add `member` / `temple` keys |
| `tanstack-app/src/query/fillerQueries.ts` | `fillerMemberQuery` / `fillerTempleQuery` |
| `tanstack-app/src/routes/f.$token.edit.member.index.tsx` | Wire new member form |
| `tanstack-app/src/routes/f.$token.edit.member.$memberId.tsx` | Wire existing member |
| `tanstack-app/src/routes/f.$token.edit.temple.index.tsx` | Wire new temple form |
| `tanstack-app/src/routes/f.$token.edit.temple.$templeId.tsx` | Wire existing temple |
| `*.test.tsx` / `*.test.ts` | Colocated Vitest |

---

### Task 0: Create feature branch

**Files:** none

**Interfaces:**
- Consumes: none
- Produces: branch `feat/filler-full-editors`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/filler-full-editors
```

If not on `main` / dirty: stop and ask.

---

### Task 1: i18n keys

**Files:**
- Modify: `tanstack-app/messages/vi.json`

**Interfaces:**
- Produces: Paraglide messages for save, sections, fields, array controls, ranks, option labels, success/error

- [ ] **Step 1: Add keys** (merge into existing JSON; keep existing `filler_*` entry keys)

```json
  "filler_save": "Lưu",
  "filler_save_success": "Đã lưu bản nháp.",
  "filler_save_error": "Không lưu được. Vui lòng thử lại.",
  "filler_add_row": "Thêm",
  "filler_remove_row": "Xóa",
  "filler_section_identity": "Định danh",
  "filler_section_contact": "Liên hệ",
  "filler_section_xuat_gia": "Xuất gia",
  "filler_section_gioi": "Giới",
  "filler_section_pham_vi": "Phẩm vị",
  "filler_section_hoc_van": "Học vấn",
  "filler_section_chuc_vu": "Chức vụ",
  "filler_section_khoa_tu": "Khóa tu",
  "filler_section_gia_dinh": "Gia đình",
  "filler_section_nguyen_vong": "Nguyện vọng",
  "filler_section_temple_identity": "Danh hiệu & đặc điểm",
  "filler_section_temple_address": "Địa chỉ",
  "filler_section_temple_tru_tri": "Trụ trì",
  "filler_section_temple_ban_qt": "Ban quản trị",
  "filler_section_temple_tang_so": "Tăng số & Phật tử",
  "filler_section_temple_hoat_dong": "Hoạt động",
  "filler_section_temple_quyet_dinh": "Quyết định",
  "filler_section_temple_xay_dung": "Xây dựng",
  "filler_section_temple_dat": "Quyền sử dụng đất",
  "filler_section_temple_phones": "Điện thoại quản lý",
  "filler_field_the_danh": "Thế danh",
  "filler_field_phap_danh": "Pháp danh",
  "filler_field_ngay_sinh": "Ngày sinh",
  "filler_field_noi_sinh": "Nơi sinh",
  "filler_field_nguyen_quan": "Nguyên quán",
  "filler_field_cccd": "CCCD",
  "filler_field_cccd_ngay_cap": "Ngày cấp CCCD",
  "filler_field_cccd_noi_cap": "Nơi cấp CCCD",
  "filler_field_cntn_so": "Số CNTN",
  "filler_field_cntn_ngay_cap": "Ngày cấp CNTN",
  "filler_field_cntn_noi_cap": "Nơi cấp CNTN",
  "filler_field_dan_toc": "Dân tộc",
  "filler_field_dien_thoai": "Điện thoại",
  "filler_field_email": "Email",
  "filler_field_dia_chi_thuong_tru": "Địa chỉ thường trú",
  "filler_field_ngay_xuat_gia": "Ngày xuất gia",
  "filler_field_noi_xuat_gia": "Nơi xuất gia",
  "filler_field_hien_tu_hoc": "Hiện tu học",
  "filler_field_bon_su": "Bổn sư",
  "filler_field_he_phai_goc": "Hệ phái gốc",
  "filler_field_giao_doan_goc": "Giáo đoàn gốc",
  "filler_field_ha_lap": "Hạ lạp",
  "filler_field_gioi_sa_di": "Giới Sa-di",
  "filler_field_gioi_ty_kheo": "Giới Tỳ-kheo",
  "filler_field_gioi_sa_di_ni": "Giới Sa-di-ni",
  "filler_field_gioi_thuc_xoa": "Giới Thức-xoa-ma-na",
  "filler_field_gioi_ty_kheo_ni": "Giới Tỳ-kheo-ni",
  "filler_field_precept_ngay_gh": "Ngày GH",
  "filler_field_precept_tai_gh": "Tại GH",
  "filler_field_precept_ton_hieu": "Tôn hiệu giới đàn",
  "filler_field_precept_ngay_hp": "Ngày hệ phái",
  "filler_field_precept_tai_hp": "Tại hệ phái",
  "filler_field_gp_giao_hoi": "Giáo phẩm Giáo hội",
  "filler_field_gp_he_phai": "Giáo phẩm Hệ phái",
  "filler_field_rank": "Phẩm vị",
  "filler_field_nam_tien_phong": "Năm tấn phong",
  "filler_field_trinh_do_the_hoc": "Trình độ thế học",
  "filler_field_ngoai_ngu": "Ngoại ngữ",
  "filler_field_trinh_do_chuyen_mon": "Trình độ chuyên môn",
  "filler_field_cap_bac": "Cấp bậc",
  "filler_field_trinh_do_phat_hoc": "Trình độ Phật học",
  "filler_field_co_ngu": "Cổ ngữ",
  "filler_field_hoc_vi": "Học vị / học hàm",
  "filler_field_chuc_vu_he_phai": "Chức vụ hệ phái",
  "filler_field_chuc_vu_ghpgvn": "Chức vụ GHPGVN",
  "filler_field_chuc_vu_doan_the": "Chức vụ đoàn thể",
  "filler_field_tu_thang_nam": "Từ tháng/năm",
  "filler_field_den_thang_nam": "Đến tháng/năm",
  "filler_field_noi_dung": "Nội dung",
  "filler_field_dia_chi": "Địa chỉ",
  "filler_field_khoa_tu_ten": "Tên khóa tu",
  "filler_field_khoa_tu_so_lan": "Số lần",
  "filler_field_ghi_chu": "Ghi chú",
  "filler_field_cha": "Cha",
  "filler_field_me": "Mẹ",
  "filler_field_anh_chi_em": "Anh chị em",
  "filler_field_ho_ten": "Họ tên",
  "filler_field_nam_sinh": "Năm sinh",
  "filler_field_nghe_nghiep": "Nghề nghiệp",
  "filler_field_noi_o": "Nơi ở",
  "filler_field_quan_he": "Quan hệ",
  "filler_field_nguyen_vong": "Nguyện vọng",
  "filler_field_danh_hieu": "Danh hiệu",
  "filler_field_phan_doan": "Phân đoàn",
  "filler_field_dac_diem": "Đặc điểm",
  "filler_field_nguoi_khai_son": "Người khai sơn",
  "filler_field_nam_thanh_lap": "Năm thành lập",
  "filler_field_tin_chu": "Tín chủ hiện cúng",
  "filler_field_dia_chi_cu": "Địa chỉ cũ",
  "filler_field_dia_chi_moi": "Địa chỉ mới",
  "filler_field_tru_tri_phap_danh": "Pháp danh trụ trì",
  "filler_field_tru_tri_phone": "Điện thoại trụ trì",
  "filler_field_tru_tri_email": "Email trụ trì",
  "filler_field_tru_tri_tien_nhiem": "Trụ trì tiền nhiệm",
  "filler_field_thoi_gian": "Thời gian",
  "filler_field_ban_qt_ten": "Tên",
  "filler_field_ban_qt_vai_tro": "Vai trò",
  "filler_field_ty_kheo": "Tỳ-kheo",
  "filler_field_ty_kheo_ni": "Tỳ-kheo-ni",
  "filler_field_sa_di": "Sa-di",
  "filler_field_tap_su": "Tập sự",
  "filler_field_so_pt_quy_y": "Số Phật tử quy y",
  "filler_field_so_pt_thuong_xuyen": "Số Phật tử thường xuyên",
  "filler_field_hoat_dong_ten": "Tên hoạt động",
  "filler_field_qd_cong_nhan_so": "QĐ công nhận — số",
  "filler_field_qd_cong_nhan_ngay": "QĐ công nhận — ngày",
  "filler_field_qd_bo_nhiem_so": "QĐ bổ nhiệm trụ trì — số",
  "filler_field_qd_bo_nhiem_ngay": "QĐ bổ nhiệm trụ trì — ngày",
  "filler_field_mo_hinh_kien_truc": "Mô hình kiến trúc",
  "filler_field_hang_muc_xd": "Hạng mục xây dựng",
  "filler_field_trung_tu": "Trùng tu",
  "filler_field_mo_ta": "Mô tả",
  "filler_field_dat_so_giay": "Số giấy",
  "filler_field_dat_ngay_cap": "Ngày cấp",
  "filler_field_dat_kv": "Diện tích khuôn viên (m²)",
  "filler_field_dat_xd": "Diện tích xây dựng (m²)",
  "filler_field_dat_canh_tac_so": "Số giấy đất canh tác",
  "filler_field_dat_canh_tac_dt": "Diện tích đất canh tác (m²)",
  "filler_field_manager_phone": "Điện thoại quản lý thêm",
  "filler_rank_hoa_thuong": "Hòa thượng",
  "filler_rank_thuong_toa": "Thượng tọa",
  "filler_rank_dai_duc": "Đại đức",
  "filler_rank_ty_kheo": "Tỳ-kheo",
  "filler_rank_ni_truong": "Ni trưởng",
  "filler_rank_ni_su": "Ni sư",
  "filler_rank_su_co": "Sư cô",
  "filler_rank_ty_kheo_ni": "Tỳ-kheo-ni",
  "filler_rank_ni_co": "Ni cô",
  "filler_opt_dac_diem_tru_so_hp": "Trụ sở hệ phái",
  "filler_opt_dac_diem_tru_so_gd": "Trụ sở giáo đoàn",
  "filler_opt_dac_diem_to_dinh": "Tổ đình",
  "filler_opt_dac_diem_thang_tich": "Thắng tích",
  "filler_opt_dac_diem_di_tich": "Di tích",
  "filler_opt_hang_muc_chinh_dien": "Chánh điện",
  "filler_opt_hang_muc_tang_xa": "Tăng xá",
  "filler_opt_hang_muc_ni_xa": "Ni xá",
  "filler_opt_hang_muc_nha_khach": "Nhà khách",
  "filler_opt_hang_muc_nha_bep": "Nhà bếp",
  "filler_opt_hang_muc_khac": "Khác"
```

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm run paraglide
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add Paraglide strings for filler full editors

EOF
)"
```

---

### Task 2: Option constants + shared form primitives

**Files:**
- Create: `tanstack-app/src/components/filler/fillerFormOptions.ts`
- Create: `tanstack-app/src/components/filler/fillerFormOptions.test.ts`
- Create: `tanstack-app/src/components/filler/FormSection.tsx`
- Create: `tanstack-app/src/components/filler/RepeatableFieldset.tsx`
- Create: `tanstack-app/src/components/filler/RepeatableFieldset.test.tsx`
- Create: `tanstack-app/src/components/filler/PreceptFields.tsx`

**Interfaces:**
- Produces:
  - `TANG_RANKS` / `NI_RANKS` as `{ value: string; label: () => string }[]`
  - `DAC_DIEM_OPTIONS` / `HANG_MUC_XAY_DUNG_OPTIONS` same shape
  - `FormSection({ title, helper?, children })`
  - `RepeatableFieldset({ label, addLabel, onAdd, children })` — children render rows; each row gets remove via render-prop or caller buttons
  - `PreceptFields({ value, onChange, disabled, legend })`

- [ ] **Step 1: Failing tests for options + repeatable**

```ts
// fillerFormOptions.test.ts
import { describe, expect, it } from 'vitest'
import {
  DAC_DIEM_OPTIONS,
  HANG_MUC_XAY_DUNG_OPTIONS,
  NI_RANKS,
  TANG_RANKS,
} from './fillerFormOptions'

describe('fillerFormOptions', () => {
  it('exposes tang and ni rank values from the DB design', () => {
    expect(TANG_RANKS.map((r) => r.value)).toEqual([
      'hoa_thuong',
      'thuong_toa',
      'dai_duc',
      'ty_kheo',
    ])
    expect(NI_RANKS.map((r) => r.value)).toEqual([
      'ni_truong',
      'ni_su',
      'su_co',
      'ty_kheo_ni',
      'ni_co',
    ])
  })

  it('exposes fixed dacDiem and hangMuc option values', () => {
    expect(DAC_DIEM_OPTIONS.length).toBeGreaterThanOrEqual(5)
    expect(HANG_MUC_XAY_DUNG_OPTIONS.length).toBeGreaterThanOrEqual(5)
  })
})
```

```tsx
// RepeatableFieldset.test.tsx — same MantineProvider/ResizeObserver setup as FillerEditorShell.test.tsx
it('calls onAdd when Thêm is clicked', async () => {
  const onAdd = vi.fn()
  render(
    <MantineProvider theme={theme}>
      <RepeatableFieldset label="Rows" addLabel="Thêm" onAdd={onAdd}>
        <Text>row</Text>
      </RepeatableFieldset>
    </MantineProvider>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Thêm' }))
  expect(onAdd).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd tanstack-app && pnpm exec vitest run src/components/filler/fillerFormOptions.test.ts src/components/filler/RepeatableFieldset.test.tsx
```

- [ ] **Step 3: Implement**

```ts
// fillerFormOptions.ts
import { m } from '#/paraglide/messages'

export type FillerOption = { value: string; label: () => string }

export const TANG_RANKS: FillerOption[] = [
  { value: 'hoa_thuong', label: () => m.filler_rank_hoa_thuong() },
  { value: 'thuong_toa', label: () => m.filler_rank_thuong_toa() },
  { value: 'dai_duc', label: () => m.filler_rank_dai_duc() },
  { value: 'ty_kheo', label: () => m.filler_rank_ty_kheo() },
]

export const NI_RANKS: FillerOption[] = [
  { value: 'ni_truong', label: () => m.filler_rank_ni_truong() },
  { value: 'ni_su', label: () => m.filler_rank_ni_su() },
  { value: 'su_co', label: () => m.filler_rank_su_co() },
  { value: 'ty_kheo_ni', label: () => m.filler_rank_ty_kheo_ni() },
  { value: 'ni_co', label: () => m.filler_rank_ni_co() },
]

export const DAC_DIEM_OPTIONS: FillerOption[] = [
  { value: 'tru_so_he_phai', label: () => m.filler_opt_dac_diem_tru_so_hp() },
  { value: 'tru_so_giao_doan', label: () => m.filler_opt_dac_diem_tru_so_gd() },
  { value: 'to_dinh', label: () => m.filler_opt_dac_diem_to_dinh() },
  { value: 'thang_tich', label: () => m.filler_opt_dac_diem_thang_tich() },
  { value: 'di_tich', label: () => m.filler_opt_dac_diem_di_tich() },
]

export const HANG_MUC_XAY_DUNG_OPTIONS: FillerOption[] = [
  { value: 'chinh_dien', label: () => m.filler_opt_hang_muc_chinh_dien() },
  { value: 'tang_xa', label: () => m.filler_opt_hang_muc_tang_xa() },
  { value: 'ni_xa', label: () => m.filler_opt_hang_muc_ni_xa() },
  { value: 'nha_khach', label: () => m.filler_opt_hang_muc_nha_khach() },
  { value: 'nha_bep', label: () => m.filler_opt_hang_muc_nha_bep() },
  { value: 'khac', label: () => m.filler_opt_hang_muc_khac() },
]
```

```tsx
// FormSection.tsx
import { Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'

export function FormSection({
  title,
  helper,
  children,
}: {
  title: string
  helper?: string
  children: ReactNode
}) {
  return (
    <Stack gap="sm" component="section">
      <Title order={3}>{title}</Title>
      {helper ? (
        <Text size="sm" c="dimmed">
          {helper}
        </Text>
      ) : null}
      <Stack gap="md">{children}</Stack>
    </Stack>
  )
}
```

```tsx
// RepeatableFieldset.tsx
import { Button, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

export function RepeatableFieldset({
  label,
  addLabel,
  onAdd,
  disabled,
  children,
}: {
  label: string
  addLabel: string
  onAdd: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center">
        <Text fw={600}>{label}</Text>
        <Button
          type="button"
          variant="light"
          size="sm"
          onClick={onAdd}
          disabled={disabled}
        >
          {addLabel}
        </Button>
      </Group>
      <Stack gap="md">{children}</Stack>
    </Stack>
  )
}
```

```tsx
// PreceptFields.tsx
import { Fieldset, Stack, TextInput } from '@mantine/core'
import type { PreceptRecord } from '#/domain/types'
import { m } from '#/paraglide/messages'

export function PreceptFields({
  legend,
  value,
  onChange,
  disabled,
}: {
  legend: string
  value: PreceptRecord
  onChange: (next: PreceptRecord) => void
  disabled?: boolean
}) {
  const set =
    (key: keyof PreceptRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.currentTarget.value })

  return (
    <Fieldset legend={legend} disabled={disabled}>
      <Stack gap="sm">
        <TextInput
          label={m.filler_field_precept_ngay_gh()}
          value={value.ngayGh ?? ''}
          onChange={set('ngayGh')}
        />
        <TextInput
          label={m.filler_field_precept_tai_gh()}
          value={value.taiGh ?? ''}
          onChange={set('taiGh')}
        />
        <TextInput
          label={m.filler_field_precept_ton_hieu()}
          value={value.tonHieuGioiDan ?? ''}
          onChange={set('tonHieuGioiDan')}
        />
        <TextInput
          label={m.filler_field_precept_ngay_hp()}
          value={value.ngayHePhai ?? ''}
          onChange={set('ngayHePhai')}
        />
        <TextInput
          label={m.filler_field_precept_tai_hp()}
          value={value.taiHePhai ?? ''}
          onChange={set('taiHePhai')}
        />
      </Stack>
    </Fieldset>
  )
}
```

- [ ] **Step 4: Tests PASS → commit**

```bash
git add tanstack-app/src/components/filler/
git commit -m "$(cat <<'EOF'
feat: add filler form options and shared field primitives

EOF
)"
```

---

### Task 3: Extend `FillerEditorShell` with sticky Save

**Files:**
- Modify: `tanstack-app/src/components/filler/FillerEditorShell.tsx`
- Modify: `tanstack-app/src/components/filler/FillerEditorShell.test.tsx`

**Interfaces:**
- Consumes: existing shell props
- Produces:
```ts
export type FillerEditorShellProps = {
  title: string
  status: FillerEditorStatus
  children?: ReactNode
  onSave?: () => void
  savePending?: boolean
  saveLabel?: string
  saveSuccess?: string | null
  saveError?: string | null
}
```
- Save button rendered only when `status === 'draft'` **and** `onSave` is provided
- Alert for `saveError` / Text for `saveSuccess` above children

- [ ] **Step 1: Update failing tests**

Replace the “does not render a Save button” test and add:

```tsx
it('renders Save when draft and onSave provided', () => {
  renderShell({ onSave: () => {}, saveLabel: 'Lưu' })
  expect(screen.getByRole('button', { name: 'Lưu' })).toBeTruthy()
})

it('hides Save when status is view', () => {
  renderShell({ status: 'view', onSave: () => {}, saveLabel: 'Lưu' })
  expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
})

it('disables Save while pending', () => {
  renderShell({ onSave: () => {}, saveLabel: 'Lưu', savePending: true })
  expect(screen.getByRole('button', { name: 'Lưu' })).toBeDisabled()
})
```

- [ ] **Step 2: Implement shell Save**

In the sticky header `Group`, after the Badge:

```tsx
{status === 'draft' && onSave ? (
  <Button
    type="button"
    onClick={onSave}
    loading={savePending}
    disabled={savePending}
  >
    {saveLabel ?? m.filler_save()}
  </Button>
) : null}
```

Above `{children}`:

```tsx
{saveError ? <Alert color="red">{saveError}</Alert> : null}
{saveSuccess ? <Text c="teal">{saveSuccess}</Text> : null}
```

Import `Alert`, `Button` from `@mantine/core`.

- [ ] **Step 3: PASS → commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add sticky Save to filler editor shell

EOF
)"
```

---

### Task 4: Query keys for filler member/temple detail

**Files:**
- Modify: `tanstack-app/src/query/fillerKeys.ts`
- Modify: `tanstack-app/src/query/fillerKeys.test.ts`
- Modify: `tanstack-app/src/query/fillerQueries.ts`

**Interfaces:**
- Produces:
```ts
member: (id: string) => [...fillerKeys.all, 'member', id]
temple: (id: string) => [...fillerKeys.all, 'temple', id]
// fillerMemberQuery(id), fillerTempleQuery(id) — getById, staleTime 5min
```

- [ ] **Step 1–4: TDD** — assert key shapes; implement queries using `memberRepo.getById` / `templeRepo.getById`

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add filler member and temple detail queries

EOF
)"
```

---

### Task 5: `TempleEditorForm` + route wiring

**Files:**
- Create: `tanstack-app/src/components/filler/TempleEditorForm.tsx`
- Create: `tanstack-app/src/components/filler/TempleEditorForm.test.tsx`
- Modify: `tanstack-app/src/routes/f.$token.edit.temple.index.tsx`
- Modify: `tanstack-app/src/routes/f.$token.edit.temple.$templeId.tsx`

**Interfaces:**
```ts
export type TempleEditorFormProps = {
  token: string
  orgUnitId: string
  templeId?: string
  initial: Partial<Temple> & { seedPhone?: string }
  status: FillerEditorStatus
  onCreated: (templeId: string) => void
}
```

- State: local copy of all temple patch fields + `extraManagerPhone` (optional TextInput for `filler_field_manager_phone`)
- On mount / `initial` change: hydrate from `initial`; if `seedPhone` and no `truTriHienNay.dienThoai`, set it
- `onSave` → `saveTempleDraft({ token, orgUnitId, templeId, patch, explicitPhones })` where `explicitPhones` includes non-empty extra manager phone
- After `created`: call `onCreated(temple.id)`; after `updated`: set success message + invalidate `fillerKeys.temple(id)`
- All 10 sections from the UI spec; locked → `disabled` on inputs; shell gets `onSave` only when draft
- `trungTu` rows: always send `moTa` and `ghiChu` strings (use `''` when blank) to satisfy TS

**Section field checklist (must all appear once):**

1. danhHieu, phanDoan, dacDiem (Checkbox.Group from `DAC_DIEM_OPTIONS`), nguoiKhaiSon, namThanhLap, tinChuHienCung  
2. diaChiCu, diaChiMoi  
3. truTriHienNay + RepeatableFieldset truTriTienNhiem  
4. RepeatableFieldset banQuanTri (`ten` required on save only if row present — empty rows filtered out)  
5. tangSoHienTru NumberInputs + soPhatTuQuyY + soPhatTuThuongXuyen  
6. RepeatableFieldset hoatDongPhatSu  
7. qdCongNhan, qdBoNhiemTruTri  
8. moHinhKienTruc, hangMucXayDung checkboxes, RepeatableFieldset trungTu  
9. quyenSuDungDat fieldset  
10. extra manager phone TextInput  

- [ ] **Step 1: Failing tests**

```tsx
it('renders temple section headings and danh hieu field', () => {
  renderForm({ /* draft props */ })
  expect(screen.getByText(m.filler_section_temple_identity())).toBeTruthy()
  expect(screen.getByLabelText(m.filler_field_danh_hieu())).toBeTruthy()
})

it('calls saveTempleDraft with patch and navigates on create', async () => {
  // mock saveTempleDraft → { temple: { id: 't1', ... }, mode: 'created' }
  // click Lưu → expect mock called; onCreated('t1')
})

it('hides Save and disables fields when status is view', () => {
  renderForm({ status: 'view' })
  expect(screen.queryByRole('button', { name: m.filler_save() })).toBeNull()
  expect(screen.getByLabelText(m.filler_field_danh_hieu())).toBeDisabled()
})
```

Mock modules:

```ts
vi.mock('#/use-cases/saveTempleDraft', () => ({
  saveTempleDraft: vi.fn(),
}))
```

Wrap with `MantineProvider` + `QueryClientProvider` + minimal router if `onCreated` only (no router needed if callback).

- [ ] **Step 2: Implement `TempleEditorForm`**

Structure:

```tsx
export function TempleEditorForm(props: TempleEditorFormProps) {
  const [draft, setDraft] = useState(/* from initial */)
  const [extraPhone, setExtraPhone] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const saveMutation = useMutation({
    mutationFn: () =>
      saveTempleDraft({
        token: props.token,
        orgUnitId: props.orgUnitId,
        templeId: props.templeId,
        patch: buildPatch(draft),
        explicitPhones: extraPhone.trim() ? [extraPhone.trim()] : [],
      }),
    onSuccess: (result) => {
      if (result.mode === 'created') props.onCreated(result.temple.id)
      else {
        setSaveSuccess(m.filler_save_success())
        queryClient.invalidateQueries({
          queryKey: fillerKeys.temple(result.temple.id),
        })
      }
    },
    onError: () => setSaveError(m.filler_save_error()),
  })

  return (
    <FillerEditorShell
      title={...} // caller can pass title via shell outside OR form owns shell
      ...
    />
  )
}
```

**Ownership:** Prefer routes render:

```tsx
<TempleEditorForm ... />
```

and **form wraps `FillerEditorShell`** (title from props or computed: new vs existing). Add `title: string` to props.

Helper `emptyTempleDraft(seedPhone?: string)` initializes nested objects safely.

Filter empty `banQuanTri` rows (missing `ten`) before save. Map `trungTu` to `{ moTa: row.moTa ?? '', ghiChu: row.ghiChu ?? '' }`.

- [ ] **Step 3: Wire routes**

`f.$token.edit.temple.index.tsx`:

```tsx
function TempleNewRoute() {
  const { token } = Route.useParams()
  const { orgUnitId, phone } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <TempleEditorForm
      title={m.filler_editor_title_temple_new()}
      token={token}
      orgUnitId={orgUnitId}
      status="draft"
      initial={{ seedPhone: phone }}
      onCreated={(templeId) =>
        navigate({
          to: '/f/$token/edit/temple/$templeId',
          params: { token, templeId },
        })
      }
    />
  )
}
```

`f.$token.edit.temple.$templeId.tsx`: load via `useQuery(fillerTempleQuery(templeId))`; loading/error UI; pass `initial={data}`, `status`, `orgUnitId={data.orgUnitId}`, `templeId`.

- [ ] **Step 4: PASS focused Vitest → commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add full temple filler editor with draft save

EOF
)"
```

---

### Task 6: `MemberEditorForm` + route wiring

**Files:**
- Create: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Create: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`
- Modify: `tanstack-app/src/routes/f.$token.edit.member.index.tsx`
- Modify: `tanstack-app/src/routes/f.$token.edit.member.$memberId.tsx`

**Interfaces:**
```ts
export type MemberEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  sanghaType: SanghaType
  cccd: string
  memberId?: string
  initial?: Partial<Member>
  status: FillerEditorStatus
  onCreated: (memberId: string) => void
}
```

- CCCD `TextInput` always `disabled` (identity locked after entry)
- Giới section: if `sanghaType === 'tang'` show SaDi + TyKheo; else SaDiNi + ThucXoa + TyKheoNi (`PreceptFields`)
- Phẩm vị: Select rank options from `TANG_RANKS` / `NI_RANKS`
- Sections 1–10 from UI spec (**skip Ảnh**)
- Save → `saveMemberDraft({ token, orgUnitId, sanghaType, cccd, patch })`
- Same create → navigate / update → success pattern as temple

**Section field checklist:**

1. theDanh, phapDanh, ngaySinh, noiSinh, nguyenQuan, cccd (locked), cccdMeta, cntn, danToc  
2. dienThoai, email, diaChiThuongTru  
3. ngayXuatGia, noiXuatGia, hienTuHoc, bonSu, hePhaiGoc, giaoDoanGoc, haLap (NumberInput) — skip `currentTempleId` select unless a simple optional TextInput for id is trivial; **prefer omit temple select** (spec says optional when temples known; YAGNI — omit)  
4. precepts by sanghaType  
5. giaoPhamGiaoHoi, giaoPhamHePhai  
6. education string fields  
7. RepeatableFieldset chucVuHePhai + chucVuGhpgvn + chucVuDoanThe text  
8. RepeatableFieldset khoaTu  
9. giaDinh cha/me fieldsets + anhChiEm repeatable  
10. nguyenVong Textarea  

- [ ] **Step 1: Failing tests**

```tsx
it('renders identity section and locked CCCD', () => {
  renderForm({ sanghaType: 'tang', cccd: '012345678901' })
  expect(screen.getByText(m.filler_section_identity())).toBeTruthy()
  expect(screen.getByLabelText(m.filler_field_cccd())).toBeDisabled()
})

it('shows tang precepts not ni precepts', () => {
  renderForm({ sanghaType: 'tang' })
  expect(screen.getByText(m.filler_field_gioi_sa_di())).toBeTruthy()
  expect(screen.queryByText(m.filler_field_gioi_sa_di_ni())).toBeNull()
})

it('shows ni precepts for ni', () => {
  renderForm({ sanghaType: 'ni' })
  expect(screen.getByText(m.filler_field_gioi_sa_di_ni())).toBeTruthy()
})

it('calls saveMemberDraft on save', async () => { /* mock + click */ })

it('add/remove chuc vu row', async () => {
  // click Thêm under chuc vu → another row; click Xóa → gone
})
```

- [ ] **Step 2: Implement `MemberEditorForm`** (same shell/mutation pattern as temple)

- [ ] **Step 3: Wire member routes** analogously to temple (search params for new; query for existing)

- [ ] **Step 4: PASS → commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add full member filler editor with draft save

EOF
)"
```

---

### Task 7: Final verification

- [ ] **Step 1: Full unit suite**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm test
```

Expected: all tests PASS.

- [ ] **Step 2: Fix any failures; commit only if fixes needed**

```bash
git commit -m "$(cat <<'EOF'
fix: stabilize filler full editor tests

EOF
)"
```

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Sticky title · status · Lưu | 3 |
| Temple sections 1–10 | 5 |
| Member sections 1–10 (no photo) | 6 |
| Tăng/Ni precept + rank options | 2, 6 |
| Repeatable add/remove | 2, 5, 6 |
| Locked view-only / no Save | 3, 5, 6 |
| save*Draft client wiring | 5, 6 |
| New → navigate to id | 5, 6 |
| i18n labels | 1 |
| Vitest coverage | 2–6 |
| No photo / no createServerFn | Global |

## Type consistency

- `SanghaType` = `'tang' | 'ni'`
- `FillerEditorStatus` = `'draft' | 'view'`
- `saveTempleDraft` / `saveMemberDraft` input shapes unchanged
- `fillerKeys.member(id)` / `fillerKeys.temple(id)`
- Option `value` strings for ranks/dacDiem/hangMuc are stable identifiers stored in Firestore arrays/rank fields
