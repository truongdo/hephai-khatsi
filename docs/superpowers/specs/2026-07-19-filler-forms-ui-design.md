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
2. Choose form type (Tăng / Ni / Tịnh xá), then Giáo đoàn.
3. Prove identity (CCCD or phone) and create or resume a draft.
4. Fill **every field** from the DB / paper templates, save drafts, and view locked records read-only.

## Product decisions

| Topic | Choice |
|-------|--------|
| Invite | One global gate; no `formType` / `orgUnitId` on invite |
| Type + org | Chosen on entry screens; persisted on the record |
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
  ├─ Step A: chọn loại form (Tăng | Ni | Tịnh xá)
  ├─ Step B: chọn Giáo đoàn (filtered by allowsTang / allowsNi / temples)
  ├─ Step C: định danh
  │    ├─ member: CCCD → resume draft | view locked | create
  │    └─ temple: phone → list matches | open draft | view locked | create new
  └─ Editor: sectioned full form + sticky Save (hidden if locked)
```

URL may keep token in path; type / org / record id can live in search params or nested routes once planned (`/f/$token/member/$id`, etc.). Prefer deep-linkable editor URLs after first save.

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

## Entry screens (structure)

### Type chooser

Three equal choices: **Tăng**, **Ni**, **Tịnh xá**.

- Mobile: stacked full-width press targets (min ~48px height).
- Desktop: three equal columns in one row, or still stacked if that reads clearer; prefer three-up only when `sm+` and labels fit one line.
- No cards-for-decoration: use bordered interactive surfaces only as the control itself.

### Giáo đoàn

Mantine `Select` (or radio list on mobile if the list is short) of org units filtered by:

- Tăng: `allowsTang`
- Ni: `allowsNi`
- Tịnh xá: all units that may host temples (all seeded giáo đoàn / ni giới that apply; follow org seed flags)

### Identity gate

- Members: CCCD input → continue. Required normalized digits.
- Temples: phone input → list temples for that phone + org; pick one or “Tạo tịnh xá mới”.

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
| `< 640px` | Single column; type choices stacked; sticky bar wraps title + Save; array rows stacked |
| `≥ 640px` | Type chooser up to 3 columns; form column still capped ~760px |
| Print (optional later) | Out of scope |

## Testing

| Layer | Focus |
|-------|--------|
| Vitest | Section field presence by form type; locked disables Save; identity gate validation messages |
| Vitest | Repeatable add/remove rows |
| Cypress | One journey: open invite → pick type → org → identity → save one required field → reload resume (thin E2E; not every field) |

## Success criteria

- Every DB-mapped paper field is editable on the correct form (Tăng / Ni / Tịnh xá).
- Entry flow works on phone and desktop without horizontal scroll.
- Draft save / resume / locked view-only match domain rules.
- Visual language matches admin brand tokens without marketing-page chrome.

## Implementation slicing (plans)

Prefer separate plans after this UI spec:

1. Filler shell + entry (routes, validate, type, org, identity gate chrome)
2. Server wiring (`createServerFn` for existing use-cases)
3. Full temple editor sections
4. Full member editor sections (+ photo)

Admin copy-link slice remains independent (`2026-07-19-admin-copy-form-link-design.md`).
