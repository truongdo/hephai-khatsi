// There is exactly one filler invite for the whole app — a fixed doc id, not a
// per-registration token — so "creating an invite" is really "creating the
// invite" (idempotent: see createInvite.ts).
export const PUBLIC_INVITE_ID = 'public'

export function retreatRegistrationInviteId(retreatId: string): string {
  return `retreat_${retreatId}`
}
