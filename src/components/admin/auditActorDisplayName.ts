import type { AuditActor } from '#/domain/auditLog'
import { normalizeVnPhone } from '#/domain/normalize'
import type { Member, Temple } from '#/domain/types'

function phonesEqual(a: string, b: string | undefined): boolean {
  if (!b) return false
  if (a === b) return true
  try {
    return normalizeVnPhone(a) === normalizeVnPhone(b)
  } catch {
    return false
  }
}

function memberPhapDanh(member: Member): string {
  return member.phapDanh?.trim() || ''
}

export function auditActorDisplayName(args: {
  actorType: AuditActor['actorType']
  actorId: string
  parentMember?: Member | null
  parentTemple?: Temple | null
  directoryMembers?: Member[]
}): string {
  const { actorType, actorId, parentMember, parentTemple, directoryMembers } =
    args

  if (actorType === 'admin' && directoryMembers) {
    const match = directoryMembers.find((m) => m.directoryAuthUid === actorId)
    const name = match ? memberPhapDanh(match) : ''
    if (name) return name
  }

  if (actorType === 'filler') {
    if (parentMember && phonesEqual(actorId, parentMember.dienThoai)) {
      const name = memberPhapDanh(parentMember)
      if (name) return name
    }
    const truTri = parentTemple?.truTriHienNay
    if (truTri && phonesEqual(actorId, truTri.dienThoai)) {
      const name = truTri.phapDanh?.trim() || ''
      if (name) return name
    }
  }

  return actorId
}
