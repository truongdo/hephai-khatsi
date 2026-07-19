# Hệ phái Khất sĩ — Database Design

Date: 2026-07-19  
App: `tanstack-app` (TanStack Start + React + Mantine)  
Database: Firebase Firestore + Firebase Storage  
Sources: org chart (Hệ phái → Giáo đoàn I–VI + Ni giới), form templates danh bạ Tịnh xá and sơ yếu lý lịch Tăng bộ / Ni bộ

## Goal

Design the Firestore data model and access patterns for managing **Hệ phái Khất sĩ**: organizational units, temples (Tịnh xá / Tịnh thất), and sangha member profiles (Tăng / Ni). Phase 1 focuses on **multi-use invitation form links**, draft editing until admin lock, and resume-by-identity (CCCD for members, phone for temples). UI details come later; this spec is the source of truth for collections, fields, flows, and security boundaries.

## Decisions

| Topic | Choice |
| --- | --- |
| Store | Firestore (flat collections) + Storage for member photos |
| Org model | Seeded `orgUnits` (7 units); no separate “Danh bộ” entity |
| Members | One `members` collection; `sanghaType: tang \| ni` |
| Temples | Flat `temples` with `orgUnitId` |
| Invite links | One multi-use global invite (`token` / doc id `public`) gates public writes; `orgUnitId` and form type are **not** on the invite — visitor chooses on the filler form (see `2026-07-19-filler-forms-ui-design.md`) |
| Draft / lock | `status: draft \| locked`; fillers edit until admin locks |
| Resume member | CCCD within same `orgUnitId` + `sanghaType` |
| Resume temple | Phone number → list of temples (`managerPhones`); one phone may manage many temples |
| Org unit source of truth | `orgUnitId` is chosen by the visitor on the filler form and persisted on the record; form label “Giáo đoàn hiện đang sinh hoạt” is display-only from that unit |
| Photos (phase 1) | Member 3×4 only (`photoPath` → Storage) |
| Public writes | Via **TanStack Start server routes/functions** + Firebase Admin SDK validating invite token — not open client list/query on PII |
| Admin | Firebase Auth + custom claims; ensure global invite; lock / list records |
| Invite revoke | Not in phase 1 |
| Server API host | TanStack Start (same app deploy); domain use-cases stay host-agnostic for later extraction |

## Out of scope

- Form and admin UI layout
- Temple land-certificate / QĐ file uploads
- Multi-level approval workflows beyond draft → locked
- Full edit-history / versioning of each save
- Realtime listeners as the default read path
- Invite revoke / expire workflows (links stay usable until replaced operationally)
- Complex inter-unit transfer workflows (can store `hePhaiGoc` / `giaoDoanGoc` fields now; process later)

## Domain hierarchy

```
Hệ phái Khất sĩ
└── orgUnit (seeded)
    ├── Giáo đoàn I … VI
    └── Ni giới Hệ phái Khất sĩ
         ├── temples
         └── members (tang | ni)
```

- **Danh bộ Chư Tăng / Chư Ni** = query over `members` by `orgUnitId` + `sanghaType`, not a stored collection.
- **Hồ sơ** = the full `members` document.
- Member optional link: `currentTempleId` (where they currently practice).
- Temple: `orgUnitId` + `managerPhones[]` for resume and multi-temple management.

`currentTempleId` is optional in phase 1 (text fields on the form still capture “hiện tu học” even if the temple doc does not exist yet).

## Collections

### `orgUnits/{orgUnitId}`

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string | e.g. `gd-i`, `ni-gioi` |
| `name` | string | Display name |
| `kind` | `giao_doan` \| `ni_gioi` | |
| `order` | number | Sort order 1–7 |
| `allowsTang` | boolean | |
| `allowsNi` | boolean | |

Seed all seven units from the org chart. Whether a given giáo đoàn currently has Ni in practice is data (`allowsNi` + actual members), not separate schemas.

### `invites/{inviteId}`

Phase 1 uses **one** global invite: doc id and `token` = `public`. It gates public writes only; it does **not** carry `orgUnitId` or form type (visitor picks those on the filler form — see `2026-07-19-filler-forms-ui-design.md`).

| Field | Type | Notes |
| --- | --- | --- |
| `token` | string | Public URL segment; phase 1 fixed to `public` (doc id = token for O(1) lookup) |
| `createdAt` | timestamp | |
| `createdBy` | string | Admin uid |

URL shape: `/f/public`. Phase 1 has no `status: revoked` / `expiresAt`; operational rotation is out of scope.

### `temples/{templeId}`

**Lifecycle / access**

| Field | Type | Notes |
| --- | --- | --- |
| `orgUnitId` | string | |
| `status` | `draft` \| `locked` | |
| `managerPhones` | string[] | VN phones normalized to digits-only (`0xxxxxxxxx`); **required ≥ 1 on first save**; array-contains for resume |
| `inviteId` | string \| null | Invite used to create; **null** when created by admin without an invite |
| `createdAt` / `updatedAt` | timestamp | |
| `lockedAt` / `lockedBy` | timestamp / string \| null | Set on lock |

**Phone mapping (temples):** On every save, the server upserts into `managerPhones` at least `truTriHienNay.dienThoai` when present, plus any explicit manager phones the filler adds. Resume always uses `managerPhones`, never only the nested trụ trì field.

**Form content** (map mẫu danh bạ Tịnh xá / Tịnh thất)

| Field | Notes |
| --- | --- |
| `danhHieu` | Name |
| `phanDoan` | Optional |
| `dacDiem` | string[] — trụ sở hệ phái/giáo đoàn, tổ đình, thắng tích, di tích… |
| `nguoiKhaiSon`, `namThanhLap`, `tinChuHienCung` | |
| `diaChiCu`, `diaChiMoi` | |
| `truTriHienNay` | `{ phapDanh, dienThoai, email }` |
| `truTriTienNhiem` | `{ phapDanh, thoiGian, ghiChu }[]` |
| `banQuanTri` | `{ ten, vaiTro? }[]` |
| `tangSoHienTru` | `{ tyKheo, tyKheoNi, saDi, tapSu }` numbers |
| `soPhatTuQuyY`, `soPhatTuThuongXuyen` | numbers |
| `hoatDongPhatSu` | `{ ten, thoiGian, ghiChu }[]` |
| `qdCongNhan` | `{ so, ngay }` |
| `qdBoNhiemTruTri` | `{ so, ngay }` |
| `moHinhKienTruc` | string |
| `hangMucXayDung` | string[] |
| `trungTu` | `{ moTa, ghiChu? }[]` — đại trùng tu / trùng tu / hạng mục mới |
| `quyenSuDungDat` | `{ soGiay, ngayCap, dienTichKhuonVienM2, dienTichXayDungM2, soGiayDatCanhTac, dienTichDatCanhTacM2 }` |

No temple document file uploads in phase 1.

### `memberCccdIndex/{orgUnitId}_{sanghaType}_{cccd}`

| Field | Type | Notes |
| --- | --- | --- |
| `memberId` | string | Points at `members/{memberId}` |
| `orgUnitId` | string | Denormalized for clarity |
| `sanghaType` | `tang` \| `ni` | |
| `cccd` | string | Same normalized value as in the doc id |

Mandatory uniqueness helper; only written inside member create transactions (Admin SDK / server).

### `members/{memberId}`

**Lifecycle / access**

| Field | Type | Notes |
| --- | --- | --- |
| `orgUnitId` | string | Current giáo đoàn / ni giới |
| `sanghaType` | `tang` \| `ni` | |
| `status` | `draft` \| `locked` | |
| `cccd` | string | Digits-only normalized; **required on first save**; unique per `orgUnitId` + `sanghaType` |
| `inviteId` | string \| null | Invite used to create; **null** when created by admin without an invite |
| `currentTempleId` | string \| null | Optional FK to `temples` |
| `photoPath` | string \| null | Storage path |
| `createdAt` / `updatedAt` | timestamp | |
| `lockedAt` / `lockedBy` | timestamp / string \| null | |

**Identity & contact**

`theDanh`, `phapDanh`, `ngaySinh`, `noiSinh`, `nguyenQuan`, `cccdMeta` `{ ngayCap, noiCap }`, `cntn` `{ so, ngayCap, noiCap }`, `danToc`, `dienThoai`, `email`, `diaChiThuongTru`, `ngayXuatGia`, `noiXuatGia`, `hienTuHoc` (free text; may duplicate temple name/address before `currentTempleId` is linked).

**Giáo đoàn hiện đang sinh hoạt:** Do not store a separate free-text org field as source of truth. Persist `orgUnitId` from the visitor’s filler-form choice; UI may show `orgUnits.name` for that id. Optional notes about origin belong in `hePhaiGoc` / `giaoDoanGoc` only.

**Precept records**

Shared shape per precept: `{ ngayGh, taiGh, tonHieuGioiDan, ngayHePhai, taiHePhai }`.

- Tăng: `gioiSaDi`, `gioiTyKheo`
- Ni: `gioiSaDiNi`, `gioiThucXoaMaNa`, `gioiTyKheoNi`

**Ranks**

`giaoPhamGiaoHoi` and `giaoPhamHePhai`: `{ rank, namTienPhong? }`.

- Tăng ranks: `hoa_thuong` \| `thuong_toa` \| `dai_duc` \| `ty_kheo` (and future-safe string union)
- Ni ranks: `ni_truong` \| `ni_su` \| `su_co` \| `ty_kheo_ni` \| `ni_co` (thức-xoa-ma-na)

**Other profile**

`haLap` (number — năm hạ lạp), `bonSu` (text: phẩm vị, pháp danh, tịnh xá, địa chỉ), `hePhaiGoc`, `giaoDoanGoc`, worldly/Buddhist education fields (`trinhDoTheHoc`, `ngoaiNgu`, `trinhDoChuyenMon`, `capBac`, `trinhDoPhatHoc`, `coNgu`, `hocViHocHam`), `chucVuHePhai[]` / `chucVuGhpgvn[]` as `{ tuThangNam, denThangNam, noiDung, diaChi }[]`, `chucVuDoanThe` (text), `khoaTu[]` as `{ ten, soLan, ghiChu }[]`, `giaDinh` `{ cha, me, anhChiEm[] }` with person shape `{ hoTen, namSinh?, ngheNghiep?, dienThoai?, noiO? }` and sibling `{ quanHe, hoTen, namSinh?, ngheNghiep?, noiO? }`, `nguyenVong`.

## Uniqueness and lookup

| Case | Rule |
| --- | --- |
| Member first save | `cccd` required; reject if missing/invalid |
| Member create / resume | If `orgUnitId + sanghaType + cccd` exists as `draft` → resume that doc; if `locked` → reject create; allow **read-only** view for filler |
| Member uniqueness | At most one member doc per `orgUnitId + sanghaType + cccd` |
| Temple first save | At least one phone in `managerPhones` required (from trụ trì phone and/or explicit manager phones); reject if none |
| Temple resume | Query `temples` where `orgUnitId` matches the filler’s chosen giáo đoàn and `managerPhones` array-contains normalized phone. **Draft** → editable; **locked** → listed as **view-only** (no update). Filler may still create a **new** temple with that phone |
| Invite | `token` unique; phase 1 always accepts existing invite docs (no revoke/expiry check) |

**Required CCCD index:** `memberCccdIndex/{orgUnitId}_{sanghaType}_{cccd}` → `{ memberId }`. Every member create/resume runs in a **transaction** that reads/writes this index so concurrent first-saves cannot duplicate CCCD. This index is mandatory in phase 1 (not optional).

## Data flows

1. **Admin ensures global invite** → idempotent create of `invites/public` if missing → share `/f/public` (header copy in admin UI).
2. **Filler creates** → validate invite token exists → visitor chooses form type + `orgUnitId` on filler form → create `temples` / `members` with `status: draft` and chosen `orgUnitId`; enforce required CCCD or `managerPhones`.
3. **Filler resumes** → same invite page “already submitted”:
   - Members: CCCD → draft editable; locked view-only.
   - Temples: phone → list matches; draft editable; locked view-only; option to create another temple.
4. **Admin locks** → `status: locked`; fillers cannot mutate (view-only only).
5. **Photo** → upload to `members/{memberId}/photo.jpg` (or equivalent) while draft; store `photoPath`. Lock does not delete the file.

## Access control

| Actor | Capabilities |
| --- | --- |
| Anonymous filler | Only through server endpoints that require an existing invite token: create draft, update **draft** (after CCCD/phone proof), read locked record view-only, upload photo for **draft** member |
| Admin (Auth + claim) | Ensure global invite; list/filter temples & members by org unit; lock records; read PII |

Firestore security rules must **deny** public `list` / client writes on `members`, `temples`, and `memberCccdIndex`. Do not expose collection queries that return CCCD/phone directories to the client.

## Indexes (minimum)

- `members`: `orgUnitId` ASC, `sanghaType` ASC, `cccd` ASC
- `members`: `orgUnitId` ASC, `sanghaType` ASC, `status` ASC
- `temples`: `orgUnitId` ASC + `managerPhones` ARRAY-CONTAINS (composite as required by the resume query)
- `temples`: `orgUnitId` ASC, `status` ASC
- `invites`: lookup by `token` (doc id preferred)

## Application layering (when implemented)

Follow workspace Firebase + TanStack Query rules:

```
firebase/init → repositories → queryOptions / mutations → hooks / loaders → UI
```

- Repositories own Firestore/Storage access and converters (Admin SDK on server; typed converters shared where possible).
- Admin UI uses `queryOptions` with intentional `staleTime`, `limit`, cursor pagination — no default `onSnapshot`.
- Filler flows call **TanStack Start server routes**; client cache keys scoped to the loaded record id after resume.

### Server API shape

```
UI / form client
  → Start server route (HTTP)
    → domain use-case (createDraft, resumeByCccd, lockMember, …)
      → repository (Firestore / Storage Admin SDK)
```

- Phase 1: all filler and privileged mutations live in Start server routes under one deploy with the app.
- Keep use-cases free of HTTP/Cloudflare specifics so a later move of heavy jobs to Functions/Queues does not change collections or client contracts.
- Firestore rules deny public client writes on `members`, `temples`, and `memberCccdIndex`.

## Error handling

| Situation | Behavior |
| --- | --- |
| Invite token not found | Reject with clear error |
| Member save without CCCD | Reject |
| Temple save with empty `managerPhones` | Reject |
| CCCD matches locked member | View-only; do not create duplicate; reject update |
| CCCD matches draft | Return that draft for edit |
| Phone matches zero temples | Allow create new temple |
| Phone matches draft temples | Allow select + edit |
| Phone matches locked temples | Show view-only; updates rejected |
| Photo upload fails | Persist text fields; leave or keep previous `photoPath` |

## Testing

- Unit: phone/CCCD normalization; form DTO ↔ Firestore document mapping; uniqueness helpers.
- Emulator integration: invite → create → resume → lock; reject filler writes on locked; rules deny public list of PII collections.
- UI/e2e deferred until form UI is specified.

## Success criteria

- All fields from the three Word templates are representable on `temples` / `members`.
- Seven org units are modeled and seedable.
- Multi-use invites create many drafts; resume works via CCCD (members) and phone (temples, many-to-one).
- First save requires CCCD (members) and ≥1 `managerPhones` (temples); trụ trì phone is synced into `managerPhones`.
- `memberCccdIndex` enforces CCCD uniqueness under concurrency.
- `orgUnitId` on filler-created records comes from the visitor’s form choice (not from the invite doc).
- Draft vs locked lifecycle is explicit; locked records are view-only for fillers.
- PII is not publicly listable; member photos stored in Storage with path on the member doc.

## Future extensions (non-blocking)

- Lean list projections or subcollections if history arrays grow large.
- Temple attachment uploads.
- Unlock + audit log.
- Invite revoke / expiry.
- Temple duplicate detection by `danhHieu` within an org unit.
- Stronger PII protection (hashed CCCD index, field-level encryption).
- Dedicate heavy/async jobs to a separate worker platform if the Start server API grows too large.
