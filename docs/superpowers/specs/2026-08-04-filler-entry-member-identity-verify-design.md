# Filler entry: verify CCCD + date of birth after phone match (member only)

Date: 2026-08-04  
Status: approved for planning  
Depends on: `2026-07-20-filler-entry-phone-lookup-design.md`  
Scope: `/f/$token` entry — Tăng/Ni resume path only

## Goal

When a public filler continues with a phone that matches an existing Tăng/Ni member, require **CCCD** and **ngày sinh** on the same entry screen before opening the member editor. Wrong values show a single error: thông tin nhập không đúng. Temple flow is unchanged.

## Product rules

| Case | Behavior |
|------|----------|
| Member form, 0 phone matches | Navigate to create (new phone). Continue not blocked by identity fields. |
| Member form, 1 phone match | Show CCCD + ngày sinh. Continue **disabled** until both match the member. Then Continue navigates to edit. |
| Member form, >1 phone matches | Treat as unexpected (product assumes one phone → one member). Generic error; do not show identity fields; do not open editor. |
| Temple form | Unchanged (phone lookup only). |
| Matched member missing `ngaySinh` | Identity check never passes; show the same wrong-info error when the user has entered values / attempted verify. |

## Non-goals

- Enforcing phone uniqueness in Firestore / indexes (assume one match; >1 is error UX only)
- Server-side identity gate beyond existing public reads
- Changing temple lookup or new-member create (still collect CCCD on the editor)
- Cypress coverage for this gate

## UI (`FillerEntryForm`)

1. Initial state: type + org + phone + Continue (as today). No CCCD / ngày sinh.
2. After a successful member phone lookup with **exactly one** match, reveal:
   - CCCD text field (reuse `filler_field_cccd` / placeholder if available)
   - Ngày sinh `DateInput` with `valueFormat="YYYY-MM-DD"` (same as member form)
3. Continue is **disabled** while `matchedMember` is set and identity is not verified.
4. When CCCD + ngày sinh both match → enable Continue; submit navigates to edit.
5. On mismatch (or missing stored `ngaySinh`) → show one Alert/error: “Thông tin nhập không đúng.” Do not reveal which field failed.
6. Changing form type, org unit, or phone clears match state, identity fields, verify error, and re-enables Continue for a fresh lookup.

Remove auto-navigate on single member match. Member pick-list UI can remain unused for the happy path; >1 matches use generic error instead of pick list for this feature’s product rule.

## Data flow

```
/f/$token
  Entry: type + org + phone → Tiếp tục
    ├─ temple → resumeTemplesByPhone (unchanged)
    └─ member → resumeMemberByPhone
         ├─ 0 → navigate create { orgUnitId, sanghaType, phone }
         ├─ 1 → set matchedMember; show CCCD + ngày sinh; Continue disabled
         │         └─ verified → Tiếp tục → edit /member/$memberId?phone=
         └─ N → generic error (no match UI / no navigate)
```

Verification is **client-side** against the member already returned by `resumeMemberByPhone` (same data already loaded for resume today). No extra Firestore round-trip.

### Match helper

Pure function, e.g. `memberIdentityMatches({ cccd, ngaySinh }, input)`:

1. Normalize input CCCD with `normalizeCccd` (invalid CCCD → fail).
2. Compare to `member.cccd`.
3. Compare ngày sinh strings as stored (`YYYY-MM-DD`); empty/missing `member.ngaySinh` → fail.
4. Returns boolean (or a small result type); UI maps failure to the shared message.

Route keeps `matchedMember` (at least `id`, `cccd`, `ngaySinh`) and passes a challenge/verified flag into the form. Second Continue after verify uses the stored member id + phone search params (same as today’s single-match navigate).

## i18n

- Add message for verify failure, e.g. `filler_error_identity_mismatch`: “Thông tin nhập không đúng.”
- Prefer existing field labels: `filler_field_cccd`, `filler_field_ngay_sinh`.

## Testing

| Layer | Coverage |
|-------|----------|
| Vitest — `memberIdentityMatches` | Match; wrong CCCD; wrong DOB; missing `ngaySinh`; invalid CCCD |
| Vitest — `FillerEntryForm` | Identity fields hidden until match; Continue disabled with match; enabled when inputs match; error on wrong input; fields hidden for temple / no match |

No new Cypress spec.

## Out of scope follow-ups

- Making `dienThoai` unique per org/sangha in rules or writes
- Hardening identity so CCCD/DOB are not present in client memory before verify (would need a different API)
