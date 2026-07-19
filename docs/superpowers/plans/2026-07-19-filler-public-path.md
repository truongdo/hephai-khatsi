# Filler Public Form Path (One-Page Entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/f/$token` with invite validation, a **single entry page** (type + giáo đoàn + CCCD + phone + Tiếp tục), and placeholder editor shells. Full paper fields come later.

**Architecture:** TanStack file routes under `f.$token`. Layout validates invite via `getInviteByToken`. Index is the combined entry form. Resume uses `resumeMemberByCccd` / `resumeTemplesByPhone` on the client. Hide `AppHeader` on `/f/*`. No `createServerFn` in this slice.

**Tech Stack:** React 19, Mantine 9, TanStack Router + Query, Paraglide, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-07-19-filler-forms-ui-design.md` (one-page entry)

## Global Constraints

- Work in the current workspace only — **never** `git worktree add`
- Before coding: create branch `feat/filler-public-path` from `main` (Task 0)
- **One entry page only** — no `/org` or `/identity` step routes
- Both CCCD and phone always visible; validate the field required by `formType`
- Do **not** build full paper form sections or Save
- Do **not** add `createServerFn` / `src/server`
- Brand: parchment / ink-teal / saffron; content column ~760px
- Prefer Vitest; Cypress optional thin invalid-token smoke
- After merge squash into `main`, delete the local feature branch unless asked otherwise

## File Structure

| File | Responsibility |
| --- | --- |
| `tanstack-app/src/routes/f.$token.tsx` | Layout: validate invite, frame, `<Outlet />` |
| `tanstack-app/src/routes/f.$token.index.tsx` | One-page entry form |
| `tanstack-app/src/routes/f.$token.edit.member.tsx` | New member placeholder |
| `tanstack-app/src/routes/f.$token.edit.member.$memberId.tsx` | Resume member placeholder |
| `tanstack-app/src/routes/f.$token.edit.temple.tsx` | New temple placeholder |
| `tanstack-app/src/routes/f.$token.edit.temple.$templeId.tsx` | Resume temple placeholder |
| `tanstack-app/src/components/filler/FillerPageFrame.tsx` | Centered parchment stack |
| `tanstack-app/src/components/filler/FillerEntryForm.tsx` | Combined entry UI + submit |
| `tanstack-app/src/components/filler/FillerEditorShell.tsx` | Sticky title/status; placeholder body |
| `tanstack-app/src/components/filler/filterOrgUnitsForFormType.ts` | Org filter helper |
| `tanstack-app/src/query/fillerKeys.ts` | Query keys |
| `tanstack-app/src/query/fillerQueries.ts` | Invite + orgUnits queries |
| `tanstack-app/messages/vi.json` | Filler copy |
| `tanstack-app/src/routes/__root.tsx` | Hide `AppHeader` on `/f` |

## URL map

| Path | Purpose |
| --- | --- |
| `/f/$token` | Entry (type + org + CCCD + phone) |
| `/f/$token/edit/member?orgUnitId=&sanghaType=&cccd=` | New member shell |
| `/f/$token/edit/member/$memberId` | Existing member shell |
| `/f/$token/edit/temple?orgUnitId=&phone=` | New temple shell |
| `/f/$token/edit/temple/$templeId` | Existing temple shell |

---

### Task 0: Create feature branch

**Files:** none

- [ ] **Step 1: Branch from main**

```bash
cd /Users/truong-d/Documents/code/phatgiaokhatsi
git checkout main
git pull
git checkout -b feat/filler-public-path
```

If not on `main` / dirty: stop and ask.

---

### Task 1: i18n keys

**Files:**
- Modify: `tanstack-app/messages/vi.json`

- [ ] **Step 1: Add keys**

```json
  "filler_invite_invalid_title": "Liên kết không hợp lệ",
  "filler_invite_invalid_body": "Không tìm thấy lời mời. Vui lòng kiểm tra lại đường dẫn.",
  "filler_entry_title": "Đăng ký",
  "filler_entry_type_label": "Loại đăng ký",
  "filler_type_tang": "Tăng",
  "filler_type_ni": "Ni",
  "filler_type_temple": "Tịnh xá",
  "filler_org_label": "Giáo đoàn / Ni giới",
  "filler_org_placeholder": "Chọn…",
  "filler_cccd_label": "CCCD",
  "filler_phone_label": "Điện thoại",
  "filler_identity_helper": "Dùng CCCD cho Tăng/Ni; điện thoại cho Tịnh xá.",
  "filler_continue": "Tiếp tục",
  "filler_identity_create_member": "Tạo hồ sơ mới",
  "filler_identity_create_temple": "Tạo tịnh xá mới",
  "filler_identity_pick_temple": "Chọn tịnh xá đã có",
  "filler_identity_not_found": "Chưa có hồ sơ. Bạn có thể tạo mới.",
  "filler_error_type_required": "Chọn loại đăng ký.",
  "filler_error_org_required": "Chọn giáo đoàn.",
  "filler_status_draft": "Bản nháp",
  "filler_status_view": "Chỉ xem",
  "filler_editor_placeholder": "Nội dung form đầy đủ sẽ có ở bước sau. Bạn đã vào đúng luồng đăng ký.",
  "filler_editor_title_member_new": "Hồ sơ thành viên (mới)",
  "filler_editor_title_member": "Hồ sơ thành viên",
  "filler_editor_title_temple_new": "Tịnh xá (mới)",
  "filler_editor_title_temple": "Tịnh xá",
  "filler_error_generic": "Có lỗi xảy ra. Vui lòng thử lại."
```

Reuse existing domain error messages for CCCD/phone invalid where already mapped in UI, or surface `error.message` / `DomainError` codes with short Vietnamese strings if needed.

- [ ] **Step 2: `pnpm run paraglide`**

- [ ] **Step 3: Commit**

```bash
git add tanstack-app/messages/vi.json
git commit -m "$(cat <<'EOF'
feat: add Paraglide strings for one-page filler entry

EOF
)"
```

---

### Task 2: Query keys + helpers

**Files:**
- Create: `tanstack-app/src/query/fillerKeys.ts`
- Create: `tanstack-app/src/query/fillerQueries.ts`
- Create: `tanstack-app/src/query/fillerKeys.test.ts`
- Create: `tanstack-app/src/components/filler/filterOrgUnitsForFormType.ts`
- Create: `tanstack-app/src/components/filler/filterOrgUnitsForFormType.test.ts`

- [ ] **Step 1: Failing tests** for `fillerKeys.invite('public')` and org filter (tang/ni/temple).

- [ ] **Step 2: Implement**

```ts
// fillerKeys.ts
export const fillerKeys = {
  all: ['filler'] as const,
  invite: (token: string) => [...fillerKeys.all, 'invite', token] as const,
  orgUnits: () => [...fillerKeys.all, 'orgUnits'] as const,
}
```

```ts
// fillerQueries.ts — inviteByTokenQuery(token), fillerOrgUnitsQuery()
// queryFn: getInviteByToken / listOrgUnits; invite retry: false; staleTime 5min
```

```ts
// filterOrgUnitsForFormType(units, formType)
// member_tang → allowsTang; member_ni → allowsNi; temple → all
```

- [ ] **Step 3: Vitest PASS → commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add filler queries and org-unit filter helper

EOF
)"
```

---

### Task 3: `FillerPageFrame` + `FillerEntryForm`

**Files:**
- Create: `tanstack-app/src/components/filler/FillerPageFrame.tsx`
- Create: `tanstack-app/src/components/filler/FillerEntryForm.tsx`
- Create: `tanstack-app/src/components/filler/FillerEntryForm.test.tsx`

**Interfaces:**
- `FillerPageFrame({ children })`
- `FillerEntryForm` props:
  - `orgUnits: OrgUnit[]`
  - `pending?: boolean`
  - `templeMatches?: Array<{ id: string; label: string }>`
  - `onSubmit: (payload: { formType: FormType; orgUnitId: string; cccd: string; phone: string }) => void`
  - `onPickTemple?: (templeId: string) => void`
  - `onCreateTemple?: () => void`
  - `onCreateMember?: () => void`
  - `notFound?: boolean`
  - `error?: string | null`

- [ ] **Step 1: Failing tests**
  - Renders type radios, org select, CCCD, phone, Tiếp tục
  - Submit without type → shows type required error; `onSubmit` not called
  - With type `member_tang`, org, CCCD → `onSubmit` called with those values (phone may be empty)
  - With type `temple`, org, phone → `onSubmit` with phone (cccd may be empty)
  - When `templeMatches` provided, shows pick list + create temple

- [ ] **Step 2: Implement UI**
  - Title `filler_entry_title`
  - `Radio.Group` or `SegmentedControl` for type
  - `Select` with `filterOrgUnitsForFormType` (disabled until type set)
  - `SimpleGrid` / `Group` for CCCD + phone (`cols={{ base: 1, sm: 2 }}`)
  - Helper text
  - Primary **Tiếp tục**
  - Client-side validation before `onSubmit` (type, org, then CCCD or phone via `normalizeCccd` / `normalizeVnPhone` try/catch → field errors)

- [ ] **Step 3: PASS → commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add one-page filler entry form

EOF
)"
```

---

### Task 4: `FillerEditorShell` placeholder

**Files:**
- Create: `tanstack-app/src/components/filler/FillerEditorShell.tsx`
- Create: `tanstack-app/src/components/filler/FillerEditorShell.test.tsx`

- [ ] **Step 1–4: TDD** — sticky title + status badge (`draft`/`view`); body default placeholder; **no Save button**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add filler editor shell placeholder

EOF
)"
```

---

### Task 5: Routes — layout, entry, editors

**Files:**
- Create route files listed in File Structure
- Modify: `tanstack-app/src/routes/__root.tsx`
- Run: `pnpm run generate-routes`

- [ ] **Step 1: Layout `f.$token.tsx`**
  - `useQuery(inviteByTokenQuery(token))`
  - Loading / invalid invite UI / `<Outlet />` inside `FillerPageFrame`

- [ ] **Step 2: Index entry page**
  - Load org units
  - On submit:
    - Map `member_tang`→`tang`, `member_ni`→`ni`
    - Call `resumeMemberByCccd` or `resumeTemplesByPhone` with `token` from params
    - Success member → navigate `edit/member/$memberId`
    - `NOT_FOUND` member → set `notFound` / navigate new member with search
    - Temples empty → new temple search route
    - One temple → `$templeId`
    - Many → set `templeMatches` on form state; pick / create handlers navigate

- [ ] **Step 3: Editor routes** — `FillerEditorShell` with titles; id routes optionally `getById` for status chip

- [ ] **Step 4: `__root.tsx`** — hide AppHeader when path starts with `/f/`

- [ ] **Step 5: `pnpm run generate-routes` + focused Vitest**

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: wire /f/$token layout, one-page entry, and editor placeholders

EOF
)"
```

---

### Task 6: Final verification

- [ ] **Step 1: `cd tanstack-app && pnpm test`** — expect PASS

- [ ] **Step 2 (optional):** Cypress invalid token smoke if Firebase env allows

- [ ] **Step 3:** Commit only if fixes needed

---

## Spec coverage

| Spec | Task |
| --- | --- |
| One-page entry (type+org+CCCD+phone) | 3, 5 |
| Validate by type; ignore unused identity field | 3 |
| Org filter by type | 2, 3 |
| Temple multi-match inline | 3, 5 |
| Invite invalid UI | 5 |
| Editor placeholder shell | 4, 5 |
| No multi-step org/identity routes | Global |
| No full forms / no server fns | Global |

## Type consistency

- `FormType` = `'temple' | 'member_tang' | 'member_ni'`
- Entry submit payload includes both `cccd` and `phone` strings; route layer picks which to use
- Resume APIs unchanged: `resumeMemberByCccd`, `resumeTemplesByPhone`
