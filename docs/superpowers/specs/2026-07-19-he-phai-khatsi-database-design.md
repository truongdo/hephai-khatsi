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
| Invite links | Multi-use; scoped by `orgUnitId` + `formType`; first save creates the record |
| Draft / lock | `status: draft \| locked`; fillers edit until admin locks |
| Resume member | CCCD within same `orgUnitId` + `sanghaType` |
| Resume temple | Phone number → list of temples (`managerPhones`); one phone may manage many temples |
| Photos (phase 1) | Member 3×4 only (`photoPath` → Storage) |
| Public writes | Via Cloud Functions (or equivalent server) validating invite token — not open client list/query on PII |
| Admin | Firebase Auth + custom claims; lock / list / manage invites |

## Out of scope

- Form and admin UI layout
- Temple land-certificate / QĐ file uploads
- Multi-level approval workflows beyond draft → locked
- Full edit-history / versioning of each save
- Realtime listeners as the default read path
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

| Field | Type | Notes |
| --- | --- | --- |
| `token` | string | Public URL segment; prefer doc id = token for O(1) lookup |
| `orgUnitId` | string | |
| `formType` | `temple` \| `member_tang` \| `member_ni` | |
| `status` | `active` \| `revoked` | |
| `createdAt` | timestamp | |
| `createdBy` | string | Admin uid |
| `expiresAt` | timestamp \| null | Optional |

URL shape (UI later): `/f/{token}`.

### `temples/{templeId}`

**Lifecycle / access**

| Field | Type | Notes |
| --- | --- | --- |
| `orgUnitId` | string | |
| `status` | `draft` \| `locked` | |
| `managerPhones` | string[] | VN phones normalized to digits-only (`0xxxxxxxxx`); array-contains for resume |
| `inviteId` | string | Invite used to create |
| `createdAt` / `updatedAt` | timestamp | |
| `lockedAt` / `lockedBy` | timestamp / string \| null | Set on lock |

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

### `members/{memberId}`

**Lifecycle / access**

| Field | Type | Notes |
| --- | --- | --- |
| `orgUnitId` | string | Current giáo đoàn / ni giới |
| `sanghaType` | `tang` \| `ni` | |
| `status` | `draft` \| `locked` | |
| `cccd` | string | Digits-only normalized; unique per `orgUnitId` + `sanghaType` |
| `inviteId` | string | |
| `currentTempleId` | string \| null | Optional FK to `temples` |
| `photoPath` | string \| null | Storage path |
| `createdAt` / `updatedAt` | timestamp | |
| `lockedAt` / `lockedBy` | timestamp / string \| null | |

**Identity & contact**

`theDanh`, `phapDanh`, `ngaySinh`, `noiSinh`, `nguyenQuan`, `cccdMeta` `{ ngayCap, noiCap }`, `cntn` `{ so, ngayCap, noiCap }`, `danToc`, `dienThoai`, `email`, `diaChiThuongTru`, `ngayXuatGia`, `noiXuatGia`, `hienTuHoc` (free text; may duplicate temple name/address before `currentTempleId` is linked).

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
| Member create | If `orgUnitId + sanghaType + cccd` exists as `draft` → resume that doc; if `locked` → reject create/edit by filler |
| Member uniqueness | At most one member doc per `orgUnitId + sanghaType + cccd` |
| Temple resume | Query `temples` where `orgUnitId == invite.orgUnitId` and `managerPhones` array-contains normalized phone; filler picks a draft temple or creates a new one (appending phone to `managerPhones`) |
| Invite | `token` unique; revoked/expired invites reject all filler operations |

Enforce uniqueness in the Cloud Function with a transaction. Optional helper collection `memberCccdIndex/{orgUnitId}_{sanghaType}_{cccd}` → `memberId` if stronger uniqueness under concurrent creates is needed.

## Data flows

1. **Admin creates invite** → `invites` doc → share `/f/{token}`.
2. **Filler creates** → validate invite → create `temples` or `members` with `status: draft`.
3. **Filler resumes** → same invite page “already submitted”:
   - Members: CCCD → load draft (or deny if locked).
   - Temples: phone → list matching temples → edit draft or create another temple.
4. **Admin locks** → `status: locked`; fillers can no longer mutate via CCCD/phone.
5. **Photo** → upload to `members/{memberId}/photo.jpg` (or equivalent) while draft; store `photoPath`. Lock does not delete the file.

## Access control

| Actor | Capabilities |
| --- | --- |
| Anonymous filler | Only through server endpoints that require a valid invite token: create draft, update own draft (after CCCD/phone proof), upload photo for that member |
| Admin (Auth + claim) | CRUD invites, list/filter temples & members by org unit, lock records, read PII |

Firestore security rules must **deny** public `list` on `members` and `temples`. Do not expose collection queries that return CCCD/phone directories to the client.

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

- Repositories own Firestore/Storage access and converters.
- Admin UI uses `queryOptions` with intentional `staleTime`, `limit`, cursor pagination — no default `onSnapshot`.
- Filler flows call Functions; client cache keys scoped to the loaded draft id after resume.

## Error handling

| Situation | Behavior |
| --- | --- |
| Invite revoked / expired | Reject with clear error |
| CCCD matches locked member | Reject edit; do not create duplicate |
| CCCD matches draft | Return that draft |
| Phone matches zero temples | Allow create new temple |
| Phone matches many temples | Require selection before edit |
| Photo upload fails | Persist text fields; leave or keep previous `photoPath` |

## Testing

- Unit: phone/CCCD normalization; form DTO ↔ Firestore document mapping; uniqueness helpers.
- Emulator integration: invite → create → resume → lock; reject filler writes on locked; rules deny public list of PII collections.
- UI/e2e deferred until form UI is specified.

## Success criteria

- All fields from the three Word templates are representable on `temples` / `members`.
- Seven org units are modeled and seedable.
- Multi-use invites create many drafts; resume works via CCCD (members) and phone (temples, many-to-one).
- Draft vs locked lifecycle is explicit; fillers cannot mutate locked records.
- PII is not publicly listable; member photos stored in Storage with path on the member doc.

## Future extensions (non-blocking)

- Lean list projections or subcollections if history arrays grow large.
- Temple attachment uploads.
- Unlock + audit log.
- Stronger PII protection (hashed CCCD index, field-level encryption).
