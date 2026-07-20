# Member form: sublabels + placeholders

Date: 2026-07-20  
Status: approved for planning  
Sources: paper `SƠ YẾU LÝ LỊCH` Tăng bộ / Ni bộ  
Depends on: `2026-07-20-filler-full-editors-design.md`

## Goal

Add Mantine `description` (sublabel) and `placeholder` to the public member editor (`MemberEditorForm` + `PreceptFields`) so guidance matches the paper forms, without changing fields, validation, or save behavior.

## Non-goals

- New fields (e.g. “Giáo đoàn hiện đang sinh hoạt” stays invite org)
- Photo upload
- Enforcing uppercase on thế danh / pháp danh
- Changing temple form copy (except shared placeholder keys already used)

## Approach

Temple-parity placeholders + **selective** descriptions from paper parentheses only.

- Reuse existing shared keys where they fit (`filler_ph_phone`, `filler_ph_email`, `filler_ph_date`, `filler_ph_number`, `filler_ph_phap_danh`, `filler_ph_ghi_chu`, …).
- Add member-only `filler_ph_*` / `filler_desc_*` keys in `messages/vi.json`, regenerate Paraglide.
- Wire `description` / `placeholder` on inputs in `MemberEditorForm` and `PreceptFields`.
- Address block: keep `VietnamAddressFields` placeholders; put the thường trú paper note as `description` on the section heading or a thin wrapper label (not duplicated on every city/ward/line control).

## Descriptions (paper → UI)

| Field / control | Key (proposed) | Text |
|-----------------|----------------|------|
| Địa chỉ thường trú (section) | `filler_desc_dia_chi_thuong_tru` | nếu thường trú Tịnh xá thì ghi rõ tên Tịnh xá |
| Nơi xuất gia | `filler_desc_noi_xuat_gia` | ghi rõ Tịnh xá và địa chỉ |
| Hiện tu học | `filler_desc_hien_tu_hoc` | ghi rõ tên Tịnh xá và địa chỉ |
| Bổn sư | `filler_desc_bon_su` | ghi rõ phẩm vị, pháp danh, Tịnh xá và địa chỉ |
| Hệ phái gốc | `filler_desc_he_phai_goc` | Bắc tông, Nam tông |
| Giáo đoàn gốc | `filler_desc_giao_doan_goc` | I, II… |
| Hạ lạp | `filler_desc_ha_lap` | tính theo Hệ phái/ Giáo đoàn hiện nay |
| Chức vụ đoàn thể | `filler_desc_chuc_vu_doan_the` | nếu có |
| Tên khóa tu | `filler_desc_khoa_tu_ten` | Bồi dưỡng Trụ trì, Khoá tu truyền thống, các khoá tu Giáo đoàn tổ chức, năm |
| Nội dung (chức vụ rows) | `filler_desc_noi_dung` | Tu học hoặc tham gia Phật sự |
| Anh chị em (fieldset / section) | `filler_desc_anh_chi_em` | ruột |

**Explicitly omitted:** “chữ in hoa” for thế danh / pháp danh (placeholders only).

Precept GH / hệ phái labels already match the paper after the recent label update; no extra descriptions unless a field remains ambiguous after placeholders.

## Placeholders

| Kind | Examples |
|------|----------|
| Shared reuse | phone, email, date (`vd: 2020-01-15`), number (`0`), pháp danh, ghi chú |
| Names | thế danh / pháp danh / họ tên — short name-shaped examples (not “chữ in hoa”) |
| Month/year | từ/đến tháng năm — `vd: 01/2010` |
| Year | năm tiến phong / năm sinh — `vd: 2015` / `vd: 1970` |
| Free text | nơi sinh, nguyên quán, nơi cấp, nơi xuất gia, hiện tu học, bổn sư, nội dung, nơi ở, nguyện vọng — short `vd:` hints where helpful |
| Selects | rank already has option labels; no placeholder text required beyond Mantine default if any |

Do not use placeholder-as-label (labels stay as today).

## Files

| File | Change |
|------|--------|
| `tanstack-app/messages/vi.json` | Add `filler_desc_*` + member `filler_ph_*` |
| Paraglide codegen | Regenerate from messages |
| `MemberEditorForm.tsx` | Pass `description` / `placeholder` |
| `PreceptFields.tsx` | Pass `placeholder` (and description only if needed) |
| Vitest | Light assertions that a few descriptions/placeholders render (optional; update only if existing tests break) |

## Success criteria

- Paper parentheticals listed above appear as Mantine descriptions (except “chữ in hoa”).
- Empty inputs show format/example placeholders consistent with temple tone (`vd: …`).
- No schema / use-case / route changes.
- Tăng and Ni share the same description/placeholder set; only precept/rank blocks differ as today.
