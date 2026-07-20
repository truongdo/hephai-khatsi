# Member Form Sublabels + Placeholders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add paper-aligned Mantine `description` sublabels and `placeholder` hints to the public member editor without changing fields or save behavior.

**Architecture:** Add Paraglide keys (`filler_desc_*`, member `filler_ph_*`), regenerate messages, then wire `description`/`placeholder` on `MemberEditorForm` and `PreceptFields`. Reuse existing shared temple placeholder keys where they already fit. Optional `description` on `RepeatableFieldset` for “Anh chị em / ruột”.

**Tech Stack:** React, Mantine 9, Paraglide (`pnpm paraglide`), Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-20-member-form-sublabels-placeholders-design.md`

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/member-form-sublabels-placeholders` from `main` (Task 0)
- No new form fields; no uppercase enforcement; no photo
- No “chữ in hoa” description on thế danh / pháp danh
- Prefer Vitest; **no new Cypress**
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/messages/vi.json` | New `filler_desc_*` + member `filler_ph_*` strings |
| `tanstack-app/src/paraglide/*` | Regenerated via `pnpm paraglide` (do not hand-edit) |
| `tanstack-app/src/components/filler/RepeatableFieldset.tsx` | Optional `description` under label |
| `tanstack-app/src/components/filler/MemberEditorForm.tsx` | Wire descriptions + placeholders |
| `tanstack-app/src/components/filler/PreceptFields.tsx` | Wire placeholders on precept inputs |
| `tanstack-app/src/components/filler/MemberEditorForm.test.tsx` | Assert key descriptions/placeholders render |

---

### Task 0: Create feature branch

**Files:** none

**Interfaces:**
- Consumes: none
- Produces: branch `feat/member-form-sublabels-placeholders`

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/member-form-sublabels-placeholders
```

If not on `main` / dirty tree with unrelated work: stop and ask.

---

### Task 1: Message keys + Paraglide + failing test

**Files:**
- Modify: `tanstack-app/messages/vi.json`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.test.tsx`
- Generate: `tanstack-app/src/paraglide/*` via `pnpm paraglide`

**Interfaces:**
- Consumes: none
- Produces: message functions listed below (callable as `m.filler_desc_…()` / `m.filler_ph_…()`)

- [ ] **Step 1: Add keys to `vi.json`**

Append (keep JSON valid; place after existing `filler_ph_*` block):

```json
  "filler_desc_dia_chi_thuong_tru": "nếu thường trú Tịnh xá thì ghi rõ tên Tịnh xá",
  "filler_desc_noi_xuat_gia": "ghi rõ Tịnh xá và địa chỉ",
  "filler_desc_hien_tu_hoc": "ghi rõ tên Tịnh xá và địa chỉ",
  "filler_desc_bon_su": "ghi rõ phẩm vị, pháp danh, Tịnh xá và địa chỉ",
  "filler_desc_he_phai_goc": "Bắc tông, Nam tông",
  "filler_desc_giao_doan_goc": "I, II…",
  "filler_desc_ha_lap": "tính theo Hệ phái/ Giáo đoàn hiện nay",
  "filler_desc_chuc_vu_doan_the": "nếu có",
  "filler_desc_khoa_tu_ten": "Bồi dưỡng Trụ trì, Khoá tu truyền thống, các khoá tu Giáo đoàn tổ chức, năm",
  "filler_desc_noi_dung": "Tu học hoặc tham gia Phật sự",
  "filler_desc_anh_chi_em": "ruột",
  "filler_ph_the_danh": "vd: Nguyễn Văn A",
  "filler_ph_phap_danh_member": "vd: Minh Tâm",
  "filler_ph_noi_sinh": "vd: Quận X, TP. Hồ Chí Minh",
  "filler_ph_nguyen_quan": "vd: tỉnh / huyện gốc",
  "filler_ph_cccd": "vd: 012345678901",
  "filler_ph_noi_cap": "vd: Cục CSQLHC về TTXH",
  "filler_ph_cntn_so": "Số chứng nhận",
  "filler_ph_dan_toc": "vd: Kinh",
  "filler_ph_month_year": "vd: 01/2010",
  "filler_ph_noi_xuat_gia": "vd: Tịnh xá …, địa chỉ …",
  "filler_ph_hien_tu_hoc": "vd: Tịnh xá …, địa chỉ …",
  "filler_ph_bon_su": "vd: TT. …, Tịnh xá …",
  "filler_ph_he_phai_goc": "vd: Bắc tông",
  "filler_ph_giao_doan_goc": "vd: I",
  "filler_ph_trinh_do": "vd: Đại học",
  "filler_ph_ngoai_ngu": "vd: Anh",
  "filler_ph_chuyen_mon": "vd: …",
  "filler_ph_cap_bac": "vd: …",
  "filler_ph_phat_hoc": "vd: …",
  "filler_ph_co_ngu": "vd: Pāli / Hán",
  "filler_ph_hoc_vi": "vd: …",
  "filler_ph_noi_dung": "vd: Trụ trì / tham gia …",
  "filler_ph_dia_chi_row": "vd: địa chỉ cơ sở",
  "filler_ph_khoa_tu_ten": "vd: Khoá tu truyền thống 2024",
  "filler_ph_quan_he": "vd: Anh / Chị / Em",
  "filler_ph_ho_ten": "vd: Nguyễn Văn B",
  "filler_ph_nam_sinh": "vd: 1970",
  "filler_ph_nghe_nghiep": "vd: …",
  "filler_ph_noi_o": "vd: địa chỉ hiện nay",
  "filler_ph_chuc_vu_doan_the": "vd: …",
  "filler_ph_nguyen_vong": "Nguyện vọng của quý thầy / sư cô",
  "filler_ph_precept_tai": "vd: nơi thọ giới",
  "filler_ph_precept_ton_hieu": "vd: tôn hiệu giới đàn"
```

Reuse existing keys (do **not** redefine): `filler_ph_phone`, `filler_ph_email`, `filler_ph_date`, `filler_ph_number`, `filler_ph_year`, `filler_ph_ghi_chu`.

Note: member pháp danh uses `filler_ph_phap_danh_member` so temple’s `filler_ph_phap_danh` (“Pháp danh”) stays unchanged.

- [ ] **Step 2: Compile Paraglide**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm paraglide
```

Expected: exits 0; `m.filler_desc_ha_lap` etc. available from `#/paraglide/messages`.

- [ ] **Step 3: Write failing test**

Add to `MemberEditorForm.test.tsx` inside `describe('MemberEditorForm')`:

```tsx
  it('shows paper descriptions and placeholders on key fields', () => {
    renderForm({ sanghaType: 'tang', cccd: '012345678901', memberId: 'm1' })

    expect(screen.getByText(m.filler_desc_dia_chi_thuong_tru())).toBeTruthy()
    expect(screen.getByText(m.filler_desc_ha_lap())).toBeTruthy()
    expect(screen.getByText(m.filler_desc_anh_chi_em())).toBeTruthy()

    expect(
      screen.getByPlaceholderText(m.filler_ph_the_danh()),
    ).toBeTruthy()
    expect(
      screen.getByPlaceholderText(m.filler_ph_phone()),
    ).toBeTruthy()
  })
```

- [ ] **Step 4: Run test — expect FAIL**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/MemberEditorForm.test.tsx
```

Expected: FAIL — descriptions/placeholders not in DOM yet.

- [ ] **Step 5: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/messages/vi.json tanstack-app/src/paraglide tanstack-app/src/components/filler/MemberEditorForm.test.tsx
git commit -m "$(cat <<'EOF'
test: add member form description and placeholder coverage

EOF
)"
```

If `src/paraglide` is gitignored, add only the tracked outputs the repo expects (often just `vi.json` + test); still run `pnpm paraglide` locally.

---

### Task 2: `RepeatableFieldset` description + wire member form

**Files:**
- Modify: `tanstack-app/src/components/filler/RepeatableFieldset.tsx`
- Modify: `tanstack-app/src/components/filler/MemberEditorForm.tsx`
- Modify: `tanstack-app/src/components/filler/PreceptFields.tsx`

**Interfaces:**
- Consumes: message keys from Task 1
- Produces: UI showing descriptions/placeholders; `RepeatableFieldset` accepts optional `description?: string`

- [ ] **Step 1: Extend `RepeatableFieldset`**

```tsx
export function RepeatableFieldset({
  label,
  description,
  addLabel,
  onAdd,
  disabled,
  children,
}: {
  label: string
  description?: string
  addLabel: string
  onAdd: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Text fw={600}>{label}</Text>
          {description ? (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </Stack>
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

- [ ] **Step 2: Wire descriptions in `MemberEditorForm`**

| Control | Prop |
| --- | --- |
| Thường trú heading block | Under the `Text fw={600}` label, add `<Text size="xs" c="dimmed">{m.filler_desc_dia_chi_thuong_tru()}</Text>` |
| `noiXuatGia` | `description={m.filler_desc_noi_xuat_gia()}` |
| `hienTuHoc` | `description={m.filler_desc_hien_tu_hoc()}` |
| `bonSu` | `description={m.filler_desc_bon_su()}` |
| `hePhaiGoc` | `description={m.filler_desc_he_phai_goc()}` |
| `giaoDoanGoc` | `description={m.filler_desc_giao_doan_goc()}` |
| `haLap` | `description={m.filler_desc_ha_lap()}` |
| `chucVuDoanThe` | `description={m.filler_desc_chuc_vu_doan_the()}` |
| khóa tu `ten` | `description={m.filler_desc_khoa_tu_ten()}` |
| chức vụ `noiDung` | `description={m.filler_desc_noi_dung()}` |
| `RepeatableFieldset` anh chị em | `description={m.filler_desc_anh_chi_em()}` |

Do **not** add description for thế danh / pháp danh.

- [ ] **Step 3: Wire placeholders in `MemberEditorForm`**

Representative mapping (apply to every matching input):

```tsx
<TextInput
  label={m.filler_field_the_danh()}
  placeholder={m.filler_ph_the_danh()}
  ...
/>
<TextInput
  label={m.filler_field_phap_danh()}
  placeholder={m.filler_ph_phap_danh_member()}
  ...
/>
<TextInput
  label={m.filler_field_ngay_sinh()}
  placeholder={m.filler_ph_date()}
  ...
/>
<TextInput
  label={m.filler_field_dien_thoai()}
  placeholder={m.filler_ph_phone()}
  ...
/>
<TextInput
  label={m.filler_field_email()}
  placeholder={m.filler_ph_email()}
  ...
/>
<NumberInput
  label={m.filler_field_ha_lap()}
  description={m.filler_desc_ha_lap()}
  placeholder={m.filler_ph_number()}
  ...
/>
<TextInput
  label={m.filler_field_tu_thang_nam()}
  placeholder={m.filler_ph_month_year()}
  ...
/>
```

Full field → placeholder key map:

| Field label key | Placeholder |
| --- | --- |
| `the_danh` | `filler_ph_the_danh` |
| `phap_danh` | `filler_ph_phap_danh_member` |
| `ngay_sinh`, `cccd_ngay_cap`, `cntn_ngay_cap`, `ngay_xuat_gia`, precept dates | `filler_ph_date` |
| `noi_sinh` | `filler_ph_noi_sinh` |
| `nguyen_quan` | `filler_ph_nguyen_quan` |
| `cccd` | `filler_ph_cccd` |
| `cccd_noi_cap`, `cntn_noi_cap` | `filler_ph_noi_cap` |
| `cntn_so` | `filler_ph_cntn_so` |
| `dan_toc` | `filler_ph_dan_toc` |
| `dien_thoai` (all phone fields) | `filler_ph_phone` |
| `email` | `filler_ph_email` |
| `noi_xuat_gia` | `filler_ph_noi_xuat_gia` |
| `hien_tu_hoc` | `filler_ph_hien_tu_hoc` |
| `bon_su` | `filler_ph_bon_su` |
| `he_phai_goc` | `filler_ph_he_phai_goc` |
| `giao_doan_goc` | `filler_ph_giao_doan_goc` |
| `ha_lap`, `khoa_tu_so_lan` | `filler_ph_number` |
| `nam_tien_phong` | `filler_ph_year` |
| `trinh_do_the_hoc` | `filler_ph_trinh_do` |
| `ngoai_ngu` | `filler_ph_ngoai_ngu` |
| `trinh_do_chuyen_mon` | `filler_ph_chuyen_mon` |
| `cap_bac` | `filler_ph_cap_bac` |
| `trinh_do_phat_hoc` | `filler_ph_phat_hoc` |
| `co_ngu` | `filler_ph_co_ngu` |
| `hoc_vi` | `filler_ph_hoc_vi` |
| `tu_thang_nam`, `den_thang_nam` | `filler_ph_month_year` |
| `noi_dung` | `filler_ph_noi_dung` |
| `dia_chi` (chức vụ row) | `filler_ph_dia_chi_row` |
| `chuc_vu_doan_the` | `filler_ph_chuc_vu_doan_the` |
| `khoa_tu_ten` | `filler_ph_khoa_tu_ten` |
| `ghi_chu` | `filler_ph_ghi_chu` |
| `ho_ten` | `filler_ph_ho_ten` |
| `nam_sinh` | `filler_ph_nam_sinh` |
| `nghe_nghiep` | `filler_ph_nghe_nghiep` |
| `noi_o` | `filler_ph_noi_o` |
| `quan_he` | `filler_ph_quan_he` |
| `nguyen_vong` | `filler_ph_nguyen_vong` |

`Select` rank fields: leave without custom placeholder (options are enough).

- [ ] **Step 4: Wire `PreceptFields` placeholders**

```tsx
<TextInput
  label={m.filler_field_precept_ngay_gh()}
  placeholder={m.filler_ph_date()}
  value={value.ngayGh ?? ''}
  onChange={set('ngayGh')}
/>
<TextInput
  label={m.filler_field_precept_tai_gh()}
  placeholder={m.filler_ph_precept_tai()}
  value={value.taiGh ?? ''}
  onChange={set('taiGh')}
/>
<TextInput
  label={m.filler_field_precept_ton_hieu()}
  placeholder={m.filler_ph_precept_ton_hieu()}
  value={value.tonHieuGioiDan ?? ''}
  onChange={set('tonHieuGioiDan')}
/>
<TextInput
  label={m.filler_field_precept_ngay_hp()}
  placeholder={m.filler_ph_date()}
  value={value.ngayHePhai ?? ''}
  onChange={set('ngayHePhai')}
/>
<TextInput
  label={m.filler_field_precept_tai_hp()}
  placeholder={m.filler_ph_precept_tai()}
  value={value.taiHePhai ?? ''}
  onChange={set('taiHePhai')}
/>
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app && pnpm exec vitest run src/components/filler/MemberEditorForm.test.tsx src/components/filler/RepeatableFieldset.test.tsx
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git add tanstack-app/src/components/filler/RepeatableFieldset.tsx \
  tanstack-app/src/components/filler/MemberEditorForm.tsx \
  tanstack-app/src/components/filler/PreceptFields.tsx
git commit -m "$(cat <<'EOF'
feat: add member form sublabels and placeholders from paper

EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Selective paper descriptions (no chữ in hoa) | Task 1 keys + Task 2 wiring |
| Placeholders temple-parity + member-specific | Task 1 keys + Task 2 maps |
| Address note on thường trú block, not each city/ward/line | Task 2 heading `Text` |
| Anh chị em “ruột” | Task 2 `RepeatableFieldset.description` |
| PreceptFields placeholders | Task 2 Step 4 |
| Vitest coverage | Task 1 failing test → Task 2 pass |
| No schema/use-case/route changes | Not in any task |
| Branch from main, no worktree | Task 0 |

No TBD/placeholder steps remain.
