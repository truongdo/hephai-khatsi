# Filler entry: phone-only identity + member lookup by phone

Date: 2026-07-20  
Status: approved for planning  
Depends on: `2026-07-19-filler-forms-ui-design.md` (entry shell), temple phone-index pattern  
Scope: `/f/$token` entry form + member resume/create path

## Goal

On the public entry screen, visitors identify themselves with **phone only** (no CCCD field).

| Form type | Entry field | Lookup |
|-----------|-------------|--------|
| Tăng / Ni | Phone + description | New member phone index → resume or create |
| Tịnh xá | Phone + description | Existing `templeManagerPhoneIndex` (unchanged) |

CCCD remains the **member document id** and is collected later on the new-member editor before first save.

## Non-goals

- Changing temple lookup behavior
- Replacing CCCD as member doc id / uniqueness key
- Migrating historical members that lack `dienThoai` (they stay unreachable by phone until a phone is saved)
- Multi-field entry (CCCD + phone) on this screen

## Entry UI (`FillerEntryForm`)

- Always show a single **Điện thoại** `TextInput` after type + org select.
- Hide CCCD entirely on this screen.
- Remove shared helper `filler_identity_helper` (“Dùng CCCD cho Tăng/Ni…”).
- Add Mantine `description` (sublabel) that changes with selected type:
  - Tăng / Ni: find an existing Tăng/Ni profile by phone.
  - Tịnh xá: find an existing tịnh xá by manager phone.
  - No type selected: omit `description` until a type is chosen.
- Validate phone with `normalizeVnPhone` for **all** form types before submit.
- Submit payload: `{ formType, orgUnitId, phone }` (drop `cccd` from the entry contract).

## Data flow

```
/f/$token
  Entry: type + org + phone → Tiếp tục
    ├─ temple  → resumeTemplesByPhone (unchanged)
    └─ member  → resumeMemberByPhone (new)
         ├─ 0 matches → navigate create with search { orgUnitId, sanghaType, phone }
         ├─ 1 match  → navigate edit /f/.../member/$memberId
         └─ N matches → inline pick list (same pattern as temples)
```

Member “not found → create” no longer passes `cccd` in the URL. Pass `phone` instead so the editor can seed `dienThoai`.

## Member phone index

Mirror `templeManagerPhoneIndex`:

| Item | Choice |
|------|--------|
| Collection | `memberPhoneIndex` |
| Doc id | `{orgUnitId}_{sanghaType}_{normalizedPhone}` |
| Payload | `{ memberIds: string[] }` (cap **20**, same as temples) |
| Rules | Public `get`; create/update only grow or keep list size ≤ 20; no delete; admin `list` |

### Writes

On every member draft create/update that includes a non-empty `dienThoai` (filler `saveMemberDraft` and admin save path), same grow-only pattern as temples:

1. Normalize phone.
2. Add `member.id` to the index doc for that phone if missing and under cap.
3. Do **not** shrink old index docs when the phone changes (rules stay grow-only). Stale ids are filtered on read.

Lookup reads the index, loads member docs, and keeps only those whose normalized `dienThoai` still matches and `sanghaType` / `orgUnitId` match.

### Use-case

`resumeMemberByPhone({ token, orgUnitId, sanghaType, phone })` → `{ members: Array<{ member, access }> }` (parallel to temples, not a single throw on empty). Empty list means “create new”; do not throw `NOT_FOUND` for zero matches (align with temple UX). Keep `resumeMemberByCccd` / `getByCccd` for doc-id paths and tests; entry route stops calling them.

## New-member editor

Today: CCCD comes from search, field is always disabled, first save uses that CCCD as doc id.

Change for **create** (`memberId` absent):

1. Search: `{ orgUnitId, sanghaType, phone }` (no `cccd`).
2. Seed `dienThoai` from `phone`.
3. CCCD `TextInput` is **editable** until first successful create.
4. First save requires valid CCCD; then navigate to `$memberId` and CCCD stays locked thereafter.

Existing-member edit path unchanged (CCCD still disabled).

## i18n

Add / adjust Vietnamese messages for:

- Phone field description (member vs temple).
- Member pick list title if N > 1 (reuse or mirror temple pick copy).
- Remove or stop using `filler_identity_helper` and `filler_cccd_label` on entry.

## Testing

| Layer | Coverage |
|-------|----------|
| Vitest — `FillerEntryForm` | Phone only; description by type; temple vs member submit payloads; no CCCD control |
| Vitest — `resumeMemberByPhone` / repo index | Normalize, 0/1/N matches, stale index filtered |
| Vitest — new member route/editor | Editable CCCD on create; seeded phone; locked CCCD after create |
| Rules integration | `memberPhoneIndex` get/create/update bounds |

No new Cypress spec unless the entry smoke already asserts CCCD (then update that assertion only).

## Out of scope follow-ups

- Backfill index for members that already have `dienThoai`
- Making phone unique per org/sangha (product may allow shared phones → pick list)
