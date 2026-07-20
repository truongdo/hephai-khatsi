# Filler full editors (member + temple)

Date: 2026-07-20  
Status: approved  
Parent: `2026-07-19-filler-forms-ui-design.md`  
Depends on: entry path (`/f/$token` + editor placeholders)

## Goal

Replace editor placeholders on `/f/$token/edit/member` and `/f/$token/edit/temple` with full paper-parity sectioned forms and sticky **Lưu**, wired to existing domain use-cases.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Temple (10 sections) + member (sections 1–10; **no photo**) |
| Save transport | Call `saveTempleDraft` / `saveMemberDraft` from the client (same as entry resume). Defer `createServerFn` + Admin SDK. |
| Form state | Controlled React state; draft shaped as `TempleProfilePatch` / `MemberProfilePatch` |
| Shell | Extend `FillerEditorShell`: sticky title · status · **Lưu** (hidden when view/locked; pending disables) |
| New → saved | After first create, navigate to `$memberId` / `$templeId`; later saves stay on page |
| Dates | `TextInput`, store `yyyy-mm-dd` (or free text where paper is month/year) |
| Multi-select | Fixed checkbox options for `dacDiem` and `hangMucXayDung` |
| Ranks | Tăng / Ni option sets from DB design |
| Errors | Inline where validated; save-level `DomainError` via Alert |
| Success | Brief confirmation text; stay on editor |
| Testing | Vitest only for this slice |

## Non-goals

- Member photo upload
- `createServerFn` / Firebase Admin public writes
- Admin lean forms gaining full paper fields
- Cypress journey for save

## Data flow

```
Entry search params / existing id
  → load draft or seed identity (cccd / phone)
  → edit sections
  → Lưu → save*Draft(token, orgUnitId, …, patch)
  → created: navigate to id route; updated: refresh cache + toast text
```

- New member: `orgUnitId`, `sanghaType`, `cccd` from search (CCCD locked).
- New temple: `orgUnitId`, `phone` from search → seed `truTriHienNay.dienThoai` / explicit phones path.
- Locked records: all fields disabled; no Save.

## Component map

| Unit | Responsibility |
|------|----------------|
| `FillerEditorShell` | Sticky chrome + Save slot |
| `FormSection` | Section title + optional helper + children |
| `RepeatableFieldset` | Add / remove stacked rows |
| `PreceptFields` | Shared precept subfields |
| `TempleEditorForm` | All temple sections + build patch |
| `MemberEditorForm` | All member sections (tang/ni variants) + build patch |
| `fillerFormOptions.ts` | Rank / đặc điểm / hạng mục option lists |

## Success criteria

- Every DB-mapped paper field (except photo) editable on the correct form.
- Draft save / locked view-only match domain rules.
- Visual language matches existing parchment / Mantine filler chrome.
