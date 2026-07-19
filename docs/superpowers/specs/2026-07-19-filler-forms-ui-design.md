# Filler forms UI (full paper parity)

Date: 2026-07-19  
Status: approved for planning  
Depends on: `2026-07-19-he-phai-khatsi-database-design.md`, `2026-07-19-admin-copy-form-link-design.md` (one global invite)  
Scope: public `/f/$token` experience — structure, layout, field coverage, mobile/desktop

## Design read

Public registration for Hệ phái Khất sĩ (Tăng / Ni / Tịnh xá): trust-first institutional audience. **Preserve** existing parchment / ink-teal / saffron tokens, Noto Serif display + Be Vietnam Pro body, and **Mantine**. Not a marketing landing redesign.

`design-taste-frontend` excludes multi-step product forms as a primary target. Apply only transferable rules: clear hierarchy, label-above-input, WCAG contrast, mobile stack, no decorative clutter, motivated motion only.

**Dials:** `DESIGN_VARIANCE: 3` · `MOTION_INTENSITY: 2` · `VISUAL_DENSITY: 5`

## Goal

Ship one invite-gated public flow where visitors:

1. Open `/f/public` (or any valid token that resolves to the global invite).
2. On **one entry page**, choose form type, Giáo đoàn, and identity (CCCD and phone fields both visible), then continue.
3. Create or resume a draft.
4. Fill **every field** from the DB / paper templates, save drafts, and view locked records read-only.

## Product decisions

| Topic | Choice |
|-------|--------|
| Invite | One global gate; no `formType` / `orgUnitId` on invite |
| Entry UX | **Single page** — type + giáo đoàn + CCCD + phone all visible; one **Tiếp tục** (not a multi-step wizard) |
| Identity fields | Both CCCD and phone always shown; submit validates the field required by type (ignore the other) |
| Type + org | Chosen on entry; persisted on the record |
| Field coverage | Full DB design parity (not admin lean fields) |
| Layout | Single-column sectioned form; sticky save bar |
| Desktop width | Content column ~720–800px centered on parchment |
| Mobile | Full width, 16px gutters; same section order; no side-by-side field grids |
| Motion | None beyond Mantine defaults / focus; honor `prefers-reduced-motion` |
| Theme | Fixed brand (no light/dark flip) |

## Non-goals

- Admin lean editors gaining full paper parity in the same plan (can share field components later)
- Invite revoke / rotate
- Multi-column “dashboard” filler chrome
- Marketing hero / decorative imagery on the form

## Information architecture

```
/f/$token
  ├─ validate invite (missing → clear error)
  ├─ Entry (one page): loại + giáo đoàn + CCCD + điện thoại → Tiếp tục
  │    ├─ member (Tăng/Ni): CCCD → resume draft | view locked | create
  │    └─ temple: phone → list matches (inline) | open draft | view locked | create new
  └─ Editor: sectioned full form + sticky Save (hidden if locked)
```

URL keeps token in path. Editor deep-links after identity: `/f/$token/edit/member/...`, `/f/$token/edit/temple/...`.

## Shell & chrome

```
┌─────────────────────────────────────────────┐
│ Sticky bar: title · status · [Lưu]          │
├─────────────────────────────────────────────┤
│ Parchment page                              │
│   max-w ~760px                              │
│   Section heading (display font)            │
│   Short helper (one line, optional)         │
│   Fields stacked (label above control)      │
│   …                                         │
└─────────────────────────────────────────────┘
```

- Status chip: `Bản nháp` / `Chỉ xem` (locked).
- Save: primary saffron/teal per existing Mantine theme; loading + disabled while pending.
- Errors: inline under fields; save-level `DomainError` via alert at top of form.
- Success: brief confirmation after save (text or notification), stay on editor.

## Entry page (single screen)

One form titled **Đăng ký** (or equivalent). All of the following are visible at once:

1. **Loại đăng ký** — radio / segmented control: Tăng | Ni | Tịnh xá (`FormType`: `member_tang` | `member_ni` | `temple`).
2. **Giáo đoàn / Ni giới** — Mantine `Select`. Options filter when type is set:
   - Tăng: `allowsTang`
   - Ni: `allowsNi`
   - Tịnh xá: all seeded units
   - No type yet: empty or disabled select until type is chosen.
3. **CCCD** and **Điện thoại** — both inputs always shown, side-by-side on `sm+`, stacked on mobile. Short helper: CCCD for Tăng/Ni; phone for Tịnh xá.
4. **Tiếp tục** — single primary action.

### Submit rules

- Require type + giáo đoàn.
- Tăng / Ni: require valid CCCD; phone may be blank (ignored).
- Tịnh xá: require valid phone; CCCD may be blank (ignored).
- Inline field errors; do not navigate away on validation failure.

### After successful identity lookup

- Member found → editor (draft or view-only if locked).
- Member not found → new-member editor shell.
- Temple: 0 matches → new temple; 1 → that temple; many → **inline pick list** on the same entry page (plus “Tạo tịnh xá mới”), then editor.

No separate `/org` or `/identity` routes.

## Member form sections (full fields)

Order matches paper / DB; Tăng vs Ni differ only in precept + rank option sets.

1. **Định danh** — `theDanh`, `phapDanh`, `ngaySinh`, `noiSinh`, `nguyenQuan`, `cccd` (locked after create), `cccdMeta`, `cntn`, `danToc`
2. **Liên hệ** — `dienThoai`, `email`, `diaChiThuongTru`
3. **Xuất gia** — `ngayXuatGia`, `noiXuatGia`, `hienTuHoc`, `currentTempleId` (optional select when temples known), `bonSu`, `hePhaiGoc`, `giaoDoanGoc`, `haLap`
4. **Giới** — Tăng: `gioiSaDi`, `gioiTyKheo`; Ni: `gioiSaDiNi`, `gioiThucXoaMaNa`, `gioiTyKheoNi` (shared precept subfields)
5. **Phẩm vị** — `giaoPhamGiaoHoi`, `giaoPhamHePhai` (rank unions per sangha type)
6. **Học vấn** — `trinhDoTheHoc`, `ngoaiNgu`, `trinhDoChuyenMon`, `capBac`, `trinhDoPhatHoc`, `coNgu`, `hocViHocHam`
7. **Chức vụ** — repeatable `chucVuHePhai[]`, `chucVuGhpgvn[]`; text `chucVuDoanThe`
8. **Khóa tu** — repeatable `khoaTu[]`
9. **Gia đình** — `giaDinh.cha`, `giaDinh.me`, repeatable `anhChiEm[]`
10. **Nguyện vọng** — `nguyenVong`
11. **Ảnh** — upload while draft; show preview; blocked when locked

Every listed DB field appears once in the appropriate section. Nested objects use grouped fieldsets; arrays use “Thêm” / remove row controls with stacked fields per row (never a wide table on mobile).

## Temple form sections (full fields)

1. **Danh hiệu & đặc điểm** — `danhHieu`, `phanDoan`, `dacDiem[]`, `nguoiKhaiSon`, `namThanhLap`, `tinChuHienCung`
2. **Địa chỉ** — `diaChiCu`, `diaChiMoi`
3. **Trụ trì** — `truTriHienNay`; repeatable `truTriTienNhiem[]`
4. **Ban quản trị** — repeatable `banQuanTri[]`
5. **Tăng số & Phật tử** — `tangSoHienTru`, `soPhatTuQuyY`, `soPhatTuThuongXuyen`
6. **Hoạt động** — repeatable `hoatDongPhatSu[]`
7. **Quyết định** — `qdCongNhan`, `qdBoNhiemTruTri`
8. **Xây dựng** — `moHinhKienTruc`, `hangMucXayDung[]`, repeatable `trungTu[]`
9. **Quyền sử dụng đất** — `quyenSuDungDat` fieldset
10. **Điện thoại quản lý** — ensure `managerPhones` / trụ trì phone rules match domain (at least one phone on first save)

## Shared field UX

- Label above control; helper optional; error below.
- No placeholder-as-label.
- Dates: consistent text or date inputs (pick one pattern in implementation plan; prefer ISO/`yyyy-mm-dd` storage).
- Numbers: Mantine `NumberInput` where the type is number.
- Multi-select string arrays (`dacDiem`, `hangMucXayDung`): tags or checkbox group from a fixed option list where the paper form has known choices; free-text tags only if the template allows.
- Contrast: ink on parchment/paper; saffron primary CTA readable (WCAG AA).
- Focus rings visible; tap targets ≥ 44px on mobile.

## Data & server

- Filler mutations only via server functions + invite token (existing domain use-cases: save/resume/photo).
- Org unit list for the picker: public-safe read (codes/names/flags only), not PII.
- After save, keep editing the same record; set `inviteId` from token; `orgUnitId` / `sanghaType` from entry choices (not from invite).

## Responsiveness checklist

| Breakpoint | Behavior |
|------------|----------|
| `< 640px` | Single column; CCCD/phone stacked; sticky editor bar wraps title + Save; array rows stacked |
| `≥ 640px` | CCCD/phone can sit in two columns; form column still capped ~760px |
| Print (optional later) | Out of scope |

## Testing

| Layer | Focus |
|-------|--------|
| Vitest | Entry page: validation by type; org filter; temple multi-match list |
| Vitest | Section field presence by form type; locked disables Save (later slices) |
| Vitest | Repeatable add/remove rows (later slices) |
| Cypress | Thin: open invite → fill entry → land on editor placeholder (or invalid token) |

## Success criteria

- Every DB-mapped paper field is editable on the correct form (Tăng / Ni / Tịnh xá).
- Entry flow works on phone and desktop without horizontal scroll.
- Draft save / resume / locked view-only match domain rules.
- Visual language matches admin brand tokens without marketing-page chrome.

## Implementation slicing (plans)

Prefer separate plans after this UI spec:

1. Filler shell + **one-page entry** (validate invite, combined form, editor placeholders)
2. Server wiring (`createServerFn` for existing use-cases)
3. Full temple editor sections
4. Full member editor sections (+ photo)

Admin copy-link slice remains independent (`2026-07-19-admin-copy-form-link-design.md`).
