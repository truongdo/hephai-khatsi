# Hệ phái Khất sĩ Database + Server API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Firestore data model, domain use-cases, and TanStack Start server functions for invites, temple/member drafts, CCCD/phone resume, lock, and member photo upload — without building form UI yet.

**Architecture:** Flat Firestore collections with a mandatory `memberCccdIndex`. All filler and admin mutations go through host-agnostic domain use-cases called from `createServerFn` handlers that use Firebase Admin SDK. Clients never list/query PII collections directly. UI forms and admin screens are a later plan.

**Tech Stack:** TanStack Start (`createServerFn`), Firebase Admin (`firebase-admin`), Firestore + Storage, Vitest, pnpm, Cloudflare Workers (`nodejs_compat` already on)

**Spec:** `docs/superpowers/specs/2026-07-19-he-phai-khatsi-database-design.md`

## Global Constraints

- Database: Firebase Firestore + Storage only (no alternate primary DB)
- Public PII writes/reads: TanStack Start server functions + Admin SDK only
- `orgUnitId` always copied from invite (authoritative)
- Member first save requires CCCD; temple first save requires ≥1 `managerPhones`
- On temple save, sync `truTriHienNay.dienThoai` into `managerPhones`
- CCCD uniqueness via transactional `memberCccdIndex` (mandatory)
- Locked records: fillers get view-only; updates rejected
- No invite revoke/expiry in this plan
- No form/admin UI in this plan
- Work in current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/he-phai-database` from `main` (Task 0)
- Follow TDD: failing test → implement → pass → commit per task

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/domain/types.ts` | Shared domain types matching the spec |
| `tanstack-app/src/domain/errors.ts` | Typed domain error codes |
| `tanstack-app/src/domain/normalize.ts` | CCCD + VN phone normalization |
| `tanstack-app/src/domain/memberCccdIndex.ts` | Index doc id helper |
| `tanstack-app/src/domain/templePhones.ts` | Merge trụ trì phone into `managerPhones` |
| `tanstack-app/src/firebase/admin.ts` | Singleton Admin app + Firestore + Storage |
| `tanstack-app/src/firebase/collections.ts` | Collection name constants |
| `tanstack-app/src/repositories/inviteRepo.ts` | Invite CRUD (Admin) |
| `tanstack-app/src/repositories/orgUnitRepo.ts` | Org unit read/seed |
| `tanstack-app/src/repositories/memberRepo.ts` | Member + CCCD index transactions |
| `tanstack-app/src/repositories/templeRepo.ts` | Temple CRUD + phone query |
| `tanstack-app/src/use-cases/*.ts` | Host-agnostic business operations |
| `tanstack-app/src/server/fillerFns.ts` | Public `createServerFn` for fillers |
| `tanstack-app/src/server/adminFns.ts` | Admin `createServerFn` (Auth + claim) |
| `firebase/firestore.rules` | Deny public client access to PII collections |
| `firebase/firestore.indexes.json` | Composite indexes from spec |
| `firebase.json` | Emulator + rules paths |
| `tanstack-app/scripts/seed-org-units.ts` | Seed 7 org units |

---

### Task 0: Create feature branch

**Files:** none (git only)

- [ ] **Step 1: Confirm on `main` and create branch**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/he-phai-database
```

Expected: current branch is `feat/he-phai-database`.

If not on `main` / pull fails / dirty tree blocks checkout: stop and ask the user before continuing.

---

### Task 1: Domain types and errors

**Files:**
- Create: `tanstack-app/src/domain/types.ts`
- Create: `tanstack-app/src/domain/errors.ts`
- Create: `tanstack-app/src/domain/types.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `OrgUnit`, `Invite`, `Temple`, `Member`, `SanghaType`, `FormType`, `RecordStatus`, `DomainError`, `isDomainError`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DomainError, isDomainError } from './errors'

describe('DomainError', () => {
  it('is recognizable via isDomainError', () => {
    const err = new DomainError('INVITE_NOT_FOUND', 'Invite not found')
    expect(isDomainError(err)).toBe(true)
    expect(err.code).toBe('INVITE_NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec vitest run src/domain/types.test.ts
```

Expected: FAIL — cannot resolve `./errors`.

- [ ] **Step 3: Implement types and errors**

Create `tanstack-app/src/domain/errors.ts`:

```ts
export type DomainErrorCode =
  | 'INVITE_NOT_FOUND'
  | 'CCCD_REQUIRED'
  | 'CCCD_INVALID'
  | 'PHONE_REQUIRED'
  | 'PHONE_INVALID'
  | 'RECORD_LOCKED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'

export class DomainError extends Error {
  readonly code: DomainErrorCode
  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError
}
```

Create `tanstack-app/src/domain/types.ts` with at least:

```ts
export type OrgUnitKind = 'giao_doan' | 'ni_gioi'
export type SanghaType = 'tang' | 'ni'
export type FormType = 'temple' | 'member_tang' | 'member_ni'
export type RecordStatus = 'draft' | 'locked'

export type OrgUnit = {
  id: string
  code: string
  name: string
  kind: OrgUnitKind
  order: number
  allowsTang: boolean
  allowsNi: boolean
}

export type Invite = {
  id: string
  token: string
  orgUnitId: string
  formType: FormType
  createdAt: string
  createdBy: string
}

export type PreceptRecord = {
  ngayGh?: string
  taiGh?: string
  tonHieuGioiDan?: string
  ngayHePhai?: string
  taiHePhai?: string
}

export type GiaoPham = {
  rank: string
  namTienPhong?: number
}

export type Member = {
  id: string
  orgUnitId: string
  sanghaType: SanghaType
  status: RecordStatus
  cccd: string
  inviteId: string
  currentTempleId: string | null
  photoPath: string | null
  theDanh?: string
  phapDanh?: string
  ngaySinh?: string
  noiSinh?: string
  nguyenQuan?: string
  cccdMeta?: { ngayCap?: string; noiCap?: string }
  cntn?: { so?: string; ngayCap?: string; noiCap?: string }
  danToc?: string
  dienThoai?: string
  email?: string
  diaChiThuongTru?: string
  ngayXuatGia?: string
  noiXuatGia?: string
  hienTuHoc?: string
  gioiSaDi?: PreceptRecord
  gioiTyKheo?: PreceptRecord
  gioiSaDiNi?: PreceptRecord
  gioiThucXoaMaNa?: PreceptRecord
  gioiTyKheoNi?: PreceptRecord
  giaoPhamGiaoHoi?: GiaoPham
  giaoPhamHePhai?: GiaoPham
  haLap?: number
  bonSu?: string
  hePhaiGoc?: string
  giaoDoanGoc?: string
  trinhDoTheHoc?: string
  ngoaiNgu?: string
  trinhDoChuyenMon?: string
  capBac?: string
  trinhDoPhatHoc?: string
  coNgu?: string
  hocViHocHam?: string
  chucVuHePhai?: Array<{
    tuThangNam?: string
    denThangNam?: string
    noiDung?: string
    diaChi?: string
  }>
  chucVuGhpgvn?: Array<{
    tuThangNam?: string
    denThangNam?: string
    noiDung?: string
    diaChi?: string
  }>
  chucVuDoanThe?: string
  khoaTu?: Array<{ ten?: string; soLan?: number; ghiChu?: string }>
  giaDinh?: {
    cha?: {
      hoTen?: string
      namSinh?: string
      ngheNghiep?: string
      dienThoai?: string
      noiO?: string
    }
    me?: {
      hoTen?: string
      namSinh?: string
      ngheNghiep?: string
      dienThoai?: string
      noiO?: string
    }
    anhChiEm?: Array<{
      quanHe?: string
      hoTen?: string
      namSinh?: string
      ngheNghiep?: string
      noiO?: string
    }>
  }
  nguyenVong?: string
  createdAt: string
  updatedAt: string
  lockedAt: string | null
  lockedBy: string | null
}

export type Temple = {
  id: string
  orgUnitId: string
  status: RecordStatus
  managerPhones: string[]
  inviteId: string
  danhHieu?: string
  phanDoan?: string
  dacDiem?: string[]
  nguoiKhaiSon?: string
  namThanhLap?: string
  tinChuHienCung?: string
  diaChiCu?: string
  diaChiMoi?: string
  truTriHienNay?: { phapDanh?: string; dienThoai?: string; email?: string }
  truTriTienNhiem?: Array<{
    phapDanh?: string
    thoiGian?: string
    ghiChu?: string
  }>
  banQuanTri?: Array<{ ten: string; vaiTro?: string }>
  tangSoHienTru?: {
    tyKheo?: number
    tyKheoNi?: number
    saDi?: number
    tapSu?: number
  }
  soPhatTuQuyY?: number
  soPhatTuThuongXuyen?: number
  hoatDongPhatSu?: Array<{ ten?: string; thoiGian?: string; ghiChu?: string }>
  qdCongNhan?: { so?: string; ngay?: string }
  qdBoNhiemTruTri?: { so?: string; ngay?: string }
  moHinhKienTruc?: string
  hangMucXayDung?: string[]
  trungTu?: Array<{ moTa: string; ghiChu?: string }>
  quyenSuDungDat?: {
    soGiay?: string
    ngayCap?: string
    dienTichKhuonVienM2?: number
    dienTichXayDungM2?: number
    soGiayDatCanhTac?: string
    dienTichDatCanhTacM2?: number
  }
  createdAt: string
  updatedAt: string
  lockedAt: string | null
  lockedBy: string | null
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run src/domain/types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/types.ts tanstack-app/src/domain/errors.ts tanstack-app/src/domain/types.test.ts
git commit -m "feat(domain): add Khất sĩ types and DomainError"
```

---

### Task 2: Normalize CCCD, phone, and temple manager phones

**Files:**
- Create: `tanstack-app/src/domain/normalize.ts`
- Create: `tanstack-app/src/domain/memberCccdIndex.ts`
- Create: `tanstack-app/src/domain/templePhones.ts`
- Create: `tanstack-app/src/domain/normalize.test.ts`

**Interfaces:**
- Consumes: `SanghaType` from `types.ts`
- Produces: `normalizeCccd`, `normalizeVnPhone`, `memberCccdIndexId`, `buildManagerPhones`

- [ ] **Step 1: Write the failing test**

Create `tanstack-app/src/domain/normalize.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeCccd, normalizeVnPhone } from './normalize'
import { memberCccdIndexId } from './memberCccdIndex'
import { buildManagerPhones } from './templePhones'

describe('normalizeCccd', () => {
  it('strips non-digits', () => {
    expect(normalizeCccd('0123 456 789012')).toBe('0123456789012')
  })
  it('rejects empty', () => {
    expect(() => normalizeCccd('  ')).toThrow()
  })
})

describe('normalizeVnPhone', () => {
  it('keeps leading 0 digits-only', () => {
    expect(normalizeVnPhone('090-123-4567')).toBe('0901234567')
  })
  it('converts +84 to 0', () => {
    expect(normalizeVnPhone('+84901234567')).toBe('0901234567')
  })
})

describe('memberCccdIndexId', () => {
  it('joins org, type, cccd', () => {
    expect(memberCccdIndexId('gd-i', 'tang', '012345678901')).toBe(
      'gd-i_tang_012345678901',
    )
  })
})

describe('buildManagerPhones', () => {
  it('merges explicit phones and tru tri phone, deduped', () => {
    expect(
      buildManagerPhones({
        explicitPhones: ['0901234567', '0901234567'],
        truTriPhone: '091-111-2222',
      }),
    ).toEqual(['0901234567', '0911112222'])
  })
  it('throws when empty after merge', () => {
    expect(() =>
      buildManagerPhones({ explicitPhones: [], truTriPhone: undefined }),
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/domain/normalize.test.ts
```

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`normalize.ts`:

```ts
import { DomainError } from './errors'

export function normalizeCccd(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) throw new DomainError('CCCD_REQUIRED', 'CCCD is required')
  if (digits.length < 9 || digits.length > 12) {
    throw new DomainError('CCCD_INVALID', 'CCCD must be 9–12 digits')
  }
  return digits
}

export function normalizeVnPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('84') && digits.length >= 11) {
    digits = `0${digits.slice(2)}`
  }
  if (!/^0\d{9,10}$/.test(digits)) {
    throw new DomainError('PHONE_INVALID', 'Invalid Vietnam phone number')
  }
  return digits
}
```

`memberCccdIndex.ts`:

```ts
import type { SanghaType } from './types'

export function memberCccdIndexId(
  orgUnitId: string,
  sanghaType: SanghaType,
  cccd: string,
): string {
  return `${orgUnitId}_${sanghaType}_${cccd}`
}
```

`templePhones.ts`:

```ts
import { DomainError } from './errors'
import { normalizeVnPhone } from './normalize'

export function buildManagerPhones(input: {
  explicitPhones: string[]
  truTriPhone?: string
}): string[] {
  const set = new Set<string>()
  for (const p of input.explicitPhones) {
    if (p.trim()) set.add(normalizeVnPhone(p))
  }
  if (input.truTriPhone?.trim()) {
    set.add(normalizeVnPhone(input.truTriPhone))
  }
  const phones = [...set]
  if (phones.length === 0) {
    throw new DomainError(
      'PHONE_REQUIRED',
      'At least one manager phone is required',
    )
  }
  return phones
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run src/domain/normalize.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/normalize.ts tanstack-app/src/domain/memberCccdIndex.ts tanstack-app/src/domain/templePhones.ts tanstack-app/src/domain/normalize.test.ts
git commit -m "feat(domain): normalize CCCD, phone, and managerPhones"
```

---

### Task 3: Install Firebase Admin and singleton init

**Files:**
- Modify: `tanstack-app/package.json`, `tanstack-app/pnpm-lock.yaml`
- Create: `tanstack-app/src/firebase/admin.ts`
- Create: `tanstack-app/src/firebase/collections.ts`
- Create: `tanstack-app/.env.example`
- Modify: `tanstack-app/.gitignore` (ensure `.env` / service account JSON ignored)

**Interfaces:**
- Consumes: env `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, optional `FIREBASE_STORAGE_BUCKET`
- Produces: `getAdminDb()`, `getAdminStorage()`, collection name constants

- [ ] **Step 1: Install packages**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm add firebase-admin
```

Do **not** add the client `firebase` SDK in this plan unless a later admin UI task needs it; Admin SDK is enough for server APIs.

- [ ] **Step 2: Create `collections.ts`**

```ts
export const COLLECTIONS = {
  orgUnits: 'orgUnits',
  invites: 'invites',
  temples: 'temples',
  members: 'members',
  memberCccdIndex: 'memberCccdIndex',
} as const
```

- [ ] **Step 3: Create `admin.ts`**

```ts
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getStorage, type Storage } from 'firebase-admin/storage'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env ${name}`)
  return value
}

function getAdminApp(): App {
  const existing = getApps()[0]
  if (existing) return existing
  return initializeApp({
    credential: cert({
      projectId: requireEnv('FIREBASE_PROJECT_ID'),
      clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
      privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp())
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp())
}
```

- [ ] **Step 4: Add `.env.example`**

```bash
FIREBASE_PROJECT_ID=hephaikhatsi-82658
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=hephaikhatsi-82658.appspot.com
```

Ensure `.env` and `*-firebase-adminsdk-*.json` are gitignored.

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/package.json tanstack-app/pnpm-lock.yaml \
  tanstack-app/src/firebase/admin.ts tanstack-app/src/firebase/collections.ts \
  tanstack-app/.env.example tanstack-app/.gitignore
git commit -m "feat(firebase): add Admin SDK init and collection names"
```

---

### Task 4: Org units seed data and repository

**Files:**
- Create: `tanstack-app/src/domain/orgUnitSeed.ts`
- Create: `tanstack-app/src/repositories/orgUnitRepo.ts`
- Create: `tanstack-app/src/domain/orgUnitSeed.test.ts`
- Create: `tanstack-app/scripts/seed-org-units.ts`

**Interfaces:**
- Consumes: `OrgUnit`, `getAdminDb`, `COLLECTIONS`
- Produces: `ORG_UNIT_SEED`, `orgUnitRepo.upsertAll()`, `orgUnitRepo.getById()`

- [ ] **Step 1: Write failing seed shape test**

```ts
import { describe, expect, it } from 'vitest'
import { ORG_UNIT_SEED } from './orgUnitSeed'

describe('ORG_UNIT_SEED', () => {
  it('has seven units ordered 1–7', () => {
    expect(ORG_UNIT_SEED).toHaveLength(7)
    expect(ORG_UNIT_SEED.map((u) => u.order)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('marks ni gioi as ni-only', () => {
    const ni = ORG_UNIT_SEED.find((u) => u.code === 'ni-gioi')
    expect(ni?.kind).toBe('ni_gioi')
    expect(ni?.allowsTang).toBe(false)
    expect(ni?.allowsNi).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm exec vitest run src/domain/orgUnitSeed.test.ts
```

- [ ] **Step 3: Implement seed + repo**

`orgUnitSeed.ts` — seven units matching the org chart (`gd-i` … `gd-vi`, `ni-gioi`). For giáo đoàn I–VI set `allowsTang: true`; set `allowsNi` true for units that historically include Ni (I, III, IV, VI) and false for II, V per chart; `ni-gioi` as above.

`orgUnitRepo.ts`:

```ts
import { getAdminDb } from '#/firebase/admin'
import { COLLECTIONS } from '#/firebase/collections'
import type { OrgUnit } from '#/domain/types'
import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'

export async function upsertAllOrgUnits(
  units: OrgUnit[] = ORG_UNIT_SEED,
): Promise<void> {
  const db = getAdminDb()
  const batch = db.batch()
  for (const unit of units) {
    const { id, ...data } = unit
    batch.set(db.collection(COLLECTIONS.orgUnits).doc(id), data, {
      merge: true,
    })
  }
  await batch.commit()
}

export async function getOrgUnitById(id: string): Promise<OrgUnit | null> {
  const snap = await getAdminDb().collection(COLLECTIONS.orgUnits).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<OrgUnit, 'id'>) }
}
```

`scripts/seed-org-units.ts`:

```ts
import { upsertAllOrgUnits } from '../src/repositories/orgUnitRepo'

await upsertAllOrgUnits()
console.log('Seeded org units')
```

Add script to `package.json`: `"seed:org-units": "node --import tsx scripts/seed-org-units.ts"` (install `tsx` as devDependency if needed).

- [ ] **Step 4: Pass unit test**

```bash
pnpm exec vitest run src/domain/orgUnitSeed.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/domain/orgUnitSeed.ts tanstack-app/src/domain/orgUnitSeed.test.ts \
  tanstack-app/src/repositories/orgUnitRepo.ts tanstack-app/scripts/seed-org-units.ts \
  tanstack-app/package.json tanstack-app/pnpm-lock.yaml
git commit -m "feat: seed seven Hệ phái org units"
```

---

### Task 5: Invite repository and use-cases

**Files:**
- Create: `tanstack-app/src/repositories/inviteRepo.ts`
- Create: `tanstack-app/src/use-cases/createInvite.ts`
- Create: `tanstack-app/src/use-cases/getInviteByToken.ts`
- Create: `tanstack-app/src/use-cases/invite.test.ts`

**Interfaces:**
- Consumes: `Invite`, `FormType`, `DomainError`, `getAdminDb`
- Produces: `createInvite({ orgUnitId, formType, createdBy, token? })`, `getInviteByToken(token)`

- [ ] **Step 1: Write failing use-case tests with an in-memory fake repo**

Prefer injecting a narrow port so tests do not need Firestore:

```ts
// invite.test.ts
import { describe, expect, it } from 'vitest'
import { createInvite } from './createInvite'
import { getInviteByToken } from './getInviteByToken'
import type { Invite } from '#/domain/types'
import { DomainError } from '#/domain/errors'

function memoryInviteStore() {
  const map = new Map<string, Invite>()
  return {
    async create(invite: Invite) {
      map.set(invite.token, invite)
    },
    async getByToken(token: string) {
      return map.get(token) ?? null
    },
  }
}

describe('invites', () => {
  it('creates and loads by token', async () => {
    const store = memoryInviteStore()
    const invite = await createInvite(
      {
        orgUnitId: 'gd-i',
        formType: 'member_tang',
        createdBy: 'admin-1',
      },
      store,
    )
    expect(invite.token.length).toBeGreaterThan(10)
    const loaded = await getInviteByToken(invite.token, store)
    expect(loaded.orgUnitId).toBe('gd-i')
  })

  it('throws INVITE_NOT_FOUND', async () => {
    const store = memoryInviteStore()
    await expect(getInviteByToken('missing', store)).rejects.toMatchObject({
      code: 'INVITE_NOT_FOUND',
    })
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm exec vitest run src/use-cases/invite.test.ts
```

- [ ] **Step 3: Implement use-cases + Firestore repo**

`createInvite.ts` — generate `token` with `crypto.randomUUID()` (or longer random), set `id = token`, `createdAt = new Date().toISOString()`.

`getInviteByToken.ts` — load or throw `DomainError('INVITE_NOT_FOUND', ...)`.

`inviteRepo.ts` — Firestore implementation of the same port (`create`, `getByToken` using doc id = token).

- [ ] **Step 4: Pass tests**

```bash
pnpm exec vitest run src/use-cases/invite.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add tanstack-app/src/repositories/inviteRepo.ts \
  tanstack-app/src/use-cases/createInvite.ts \
  tanstack-app/src/use-cases/getInviteByToken.ts \
  tanstack-app/src/use-cases/invite.test.ts
git commit -m "feat: invite create and lookup use-cases"
```

---

### Task 6: Member draft save + CCCD resume + lock

**Files:**
- Create: `tanstack-app/src/repositories/memberRepo.ts`
- Create: `tanstack-app/src/use-cases/saveMemberDraft.ts`
- Create: `tanstack-app/src/use-cases/resumeMemberByCccd.ts`
- Create: `tanstack-app/src/use-cases/lockMember.ts`
- Create: `tanstack-app/src/use-cases/memberDraft.test.ts`

**Interfaces:**
- Consumes: `getInviteByToken`, `normalizeCccd`, `memberCccdIndexId`, `Member`, `DomainError`
- Produces:
  - `saveMemberDraft({ token, cccd, patch })` → `{ member, mode: 'created' | 'updated' }`
  - `resumeMemberByCccd({ token, cccd })` → `{ member, access: 'edit' | 'view' }`
  - `lockMember({ memberId, lockedBy })` → `Member`

**Rules to encode in tests:**
1. Missing CCCD → `CCCD_REQUIRED`
2. First save creates member + index; `orgUnitId`/`sanghaType` from invite (`member_tang` → `tang`, `member_ni` → `ni`)
3. Second save same CCCD updates draft
4. Locked member: resume returns `access: 'view'`; save throws `RECORD_LOCKED`
5. Wrong formType invite (temple) rejected for member save

- [ ] **Step 1: Write failing tests** (in-memory member + index store implementing the port used by use-cases)

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm exec vitest run src/use-cases/memberDraft.test.ts
```

- [ ] **Step 3: Implement use-cases + `memberRepo`**

Firestore `createOrGetByCccd` must use a **transaction**:
1. Read `memberCccdIndex/{orgUnitId}_{sanghaType}_{cccd}`
2. If missing → create `members` doc + index
3. If present → load member; if `locked` and caller is filler save → throw `RECORD_LOCKED`

- [ ] **Step 4: Pass tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: member draft save, CCCD resume, and lock"
```

---

### Task 7: Temple draft save + phone resume + lock

**Files:**
- Create: `tanstack-app/src/repositories/templeRepo.ts`
- Create: `tanstack-app/src/use-cases/saveTempleDraft.ts`
- Create: `tanstack-app/src/use-cases/resumeTemplesByPhone.ts`
- Create: `tanstack-app/src/use-cases/lockTemple.ts`
- Create: `tanstack-app/src/use-cases/templeDraft.test.ts`

**Interfaces:**
- Consumes: `buildManagerPhones`, `getInviteByToken`, `Temple`
- Produces:
  - `saveTempleDraft({ token, templeId?, patch, explicitPhones? })` → `{ temple, mode }`
  - `resumeTemplesByPhone({ token, phone })` → `{ temples: Array<{ temple, access: 'edit' | 'view' }> }`
  - `lockTemple({ templeId, lockedBy })`

**Rules to encode in tests:**
1. No phones after merge → `PHONE_REQUIRED`
2. Create new temple when `templeId` omitted
3. Update draft by `templeId`; locked → `RECORD_LOCKED`
4. Resume lists drafts as `edit`, locked as `view`
5. Invite must be `formType: 'temple'`

- [ ] **Step 1: Write failing tests**

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm exec vitest run src/use-cases/templeDraft.test.ts
```

- [ ] **Step 3: Implement** — `templeRepo.listByOrgAndPhone(orgUnitId, phone)` uses `where('orgUnitId','==',orgUnitId)` + `where('managerPhones','array-contains',phone)`.

- [ ] **Step 4: Pass tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: temple draft save, phone resume, and lock"
```

---

### Task 8: Member photo upload use-case

**Files:**
- Create: `tanstack-app/src/use-cases/uploadMemberPhoto.ts`
- Create: `tanstack-app/src/use-cases/uploadMemberPhoto.test.ts`
- Modify: `tanstack-app/src/repositories/memberRepo.ts` (set `photoPath`)

**Interfaces:**
- Consumes: member must be `draft`; Storage Admin
- Produces: `uploadMemberPhoto({ memberId, cccd, bytes, contentType })` → `{ photoPath }`

- [ ] **Step 1: Failing test** — locked member throws `RECORD_LOCKED`; draft updates `photoPath` to `members/{id}/photo.jpg` (fake storage port in unit test).

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — verify CCCD matches member; upload via injected `storage.put(path, bytes, contentType)`; persist `photoPath` on member.

- [ ] **Step 4: Pass tests**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: upload draft member 3x4 photo"
```

---

### Task 9: Wire TanStack Start server functions

**Files:**
- Create: `tanstack-app/src/server/fillerFns.ts`
- Create: `tanstack-app/src/server/adminFns.ts`
- Create: `tanstack-app/src/server/mapDomainError.ts`

**Interfaces:**
- Consumes: all use-cases + Firestore repos; admin uses `getAuth().verifyIdToken` + custom claim `admin === true`
- Produces: exported `createServerFn`s callable later from UI

- [ ] **Step 1: Add `mapDomainError`**

```ts
import { isDomainError } from '#/domain/errors'

export function toErrorPayload(err: unknown): {
  ok: false
  code: string
  message: string
} {
  if (isDomainError(err)) {
    return { ok: false, code: err.code, message: err.message }
  }
  console.error(err)
  return { ok: false, code: 'INTERNAL', message: 'Internal error' }
}
```

- [ ] **Step 2: Implement filler server functions** (POST), each validating a plain object input:

- `getInviteFn({ token })`
- `saveMemberDraftFn({ token, cccd, patch })`
- `resumeMemberByCccdFn({ token, cccd })`
- `saveTempleDraftFn({ token, templeId?, patch, explicitPhones? })`
- `resumeTemplesByPhoneFn({ token, phone })`
- `uploadMemberPhotoFn({ token, memberId, cccd, base64, contentType })`

Use `createServerFn({ method: 'POST' }).inputValidator(...).handler(...)`.

- [ ] **Step 3: Implement admin server functions**

- `createInviteFn({ orgUnitId, formType, idToken })`
- `lockMemberFn({ memberId, idToken })`
- `lockTempleFn({ templeId, idToken })`
- `seedOrgUnitsFn({ idToken })` (optional convenience)

Helper `assertAdmin(idToken)`:

```ts
import { getAuth } from 'firebase-admin/auth'
import { DomainError } from '#/domain/errors'
import { getAdminApp } from '#/firebase/admin' // export app getter if needed

export async function assertAdmin(idToken: string): Promise<{ uid: string }> {
  const decoded = await getAuth().verifyIdToken(idToken)
  if (decoded.admin !== true) {
    throw new DomainError('FORBIDDEN', 'Admin claim required')
  }
  return { uid: decoded.uid }
}
```

- [ ] **Step 4: Smoke-compile**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi/tanstack-app
pnpm exec tsc --noEmit
pnpm test
```

Expected: typecheck clean enough for new files; existing + new unit tests PASS. (If `tsc` is not configured project-wide, `pnpm test` is the gate.)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: expose filler and admin server functions"
```

---

### Task 10: Firestore rules and indexes

**Files:**
- Create: `firebase/firestore.rules`
- Create: `firebase/firestore.indexes.json`
- Create: `firebase.json` (repo root)
- Create: `firebase/firestore.rules.test.md` (short manual checklist) **or** skip if using emulator tests in Task 11 only

**Interfaces:**
- Produces: deployed-ready rules denying public read/write on PII collections; composite indexes from spec

- [ ] **Step 1: Write `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null && request.auth.token.admin == true;
    }

    match /orgUnits/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /invites/{id} {
      allow read, write: if false; // server Admin SDK only
    }

    match /temples/{id} {
      allow read, write: if false;
    }

    match /members/{id} {
      allow read, write: if false;
    }

    match /memberCccdIndex/{id} {
      allow read, write: if false;
    }
  }
}
```

Note: Admin SDK bypasses rules. Client SDK (future admin UI) will need either Admin-only server reads or loosened `isAdmin()` read rules — prefer keeping PII `false` and routing admin lists through server functions until UI plan.

If admin UI later needs direct client reads, change only then to `allow read: if isAdmin()`.

For this plan, set:

```
match /temples/{id} { allow read: if isAdmin(); allow write: if false; }
match /members/{id} { allow read: if isAdmin(); allow write: if false; }
match /invites/{id} { allow read: if isAdmin(); allow write: if false; }
match /memberCccdIndex/{id} { allow read, write: if false; }
```

- [ ] **Step 2: Write `firestore.indexes.json`**

Include composites:

- `members`: `orgUnitId` ASC, `sanghaType` ASC, `cccd` ASC
- `members`: `orgUnitId` ASC, `sanghaType` ASC, `status` ASC
- `temples`: `orgUnitId` ASC, `managerPhones` ARRAY, `status` ASC (if filtered together; otherwise `orgUnitId` + `managerPhones`)
- `temples`: `orgUnitId` ASC, `status` ASC

- [ ] **Step 3: Write root `firebase.json`**

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add firebase/firestore.rules firebase/firestore.indexes.json firebase.json
git commit -m "chore(firebase): add Firestore rules and indexes"
```

---

### Task 11: Emulator integration smoke (optional but recommended)

**Files:**
- Create: `tanstack-app/src/use-cases/memberDraft.integration.test.ts`
- Modify: `tanstack-app/package.json` (script `test:integration`)
- DevDependency: `firebase-tools` at repo or app level if not present

**Interfaces:**
- Uses `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and Admin SDK against emulator

- [ ] **Step 1: Document run command**

```bash
# terminal A
cd /Users/truong-d/Documents/code/phatgiaokhatsi
npx firebase emulators:start --only firestore

# terminal B
cd tanstack-app
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
FIREBASE_PROJECT_ID=demo-khatsi \
FIREBASE_CLIENT_EMAIL=demo@demo.iam.gserviceaccount.com \
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...\n-----END PRIVATE KEY-----\n" \
pnpm exec vitest run src/use-cases/memberDraft.integration.test.ts
```

For emulator, Admin can init with a fake cert **or** use the documented emulator pattern: set `FIRESTORE_EMULATOR_HOST` and `initializeApp({ projectId: 'demo-khatsi' })` without credentials when only talking to the emulator. Prefer the no-cred emulator init in a test-only `getTestAdminDb()` helper to avoid shipping fake keys.

- [ ] **Step 2: Integration test flow**

1. Seed invite `member_tang` for `gd-i`
2. `saveMemberDraft` with CCCD
3. `resumeMemberByCccd` → edit
4. `lockMember`
5. `saveMemberDraft` → `RECORD_LOCKED`
6. Assert `memberCccdIndex` doc exists

- [ ] **Step 3: Commit if green**

```bash
git commit -m "test: emulator smoke for member draft and lock"
```

If emulator setup blocks the agent environment, skip this task and note it in the PR; unit tests from Tasks 5–8 remain the required gate.

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
| --- | --- |
| Types for temples/members/org/invites | 1 |
| CCCD/phone normalize + managerPhones sync | 2, 7 |
| `memberCccdIndex` transactional uniqueness | 6 |
| Seven org units seed | 4 |
| Multi-use invites | 5, 9 |
| Draft/lock + view-only locked | 6, 7 |
| Resume CCCD / phone | 6, 7 |
| Photo 3×4 Storage | 8 |
| Start server API + Admin claim | 9 |
| Rules deny public PII writes | 10 |
| Indexes | 10 |
| No form UI / no revoke | Explicitly out of plan |

## Out of this plan (next)

- Filler form UI at `/f/$token`
- Admin console UI (lists, lock buttons, invite link copy)
- Client Firebase Auth login UX
- TanStack Query `queryOptions` for admin lists
- Cypress flows for forms

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-19-he-phai-database.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
