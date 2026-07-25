import type { Member } from '#/domain/types'
import { deleteTemplePhotoObject } from '#/photos/photosApiClient'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type TempleDeleteBlocker = {
  templeId: string
  templeLabel: string
  members: Array<{ id: string; label: string }>
}

export type DeleteTemplesResult =
  | { ok: true }
  | { ok: false; blockers: TempleDeleteBlocker[] }

function memberLabel(member: Member): string {
  return member.phapDanh || member.theDanh || member.id
}

export async function deleteTemples(
  input: { ids: string[]; idToken: string },
  deps?: { templeStore?: TempleStore; memberStore?: MemberStore },
  deletePhoto: (templeId: string) => Promise<void> = (id) =>
    deleteTemplePhotoObject({ templeId: id, idToken: input.idToken }),
): Promise<DeleteTemplesResult> {
  if (input.ids.length === 0) {
    return { ok: true }
  }

  const templeStore = deps?.templeStore ?? templeRepo
  const memberStore = deps?.memberStore ?? memberRepo

  const members = await memberStore.listByCurrentTempleIds(input.ids)
  if (members.length > 0) {
    const membersByTempleId = new Map<string, Member[]>()
    for (const member of members) {
      if (member.currentTempleId === null) continue
      const existing = membersByTempleId.get(member.currentTempleId) ?? []
      membersByTempleId.set(member.currentTempleId, [...existing, member])
    }

    const blockers: TempleDeleteBlocker[] = []
    for (const templeId of input.ids) {
      const templeMembers = membersByTempleId.get(templeId)
      if (!templeMembers?.length) continue

      const temple = await templeStore.getById(templeId)
      blockers.push({
        templeId,
        templeLabel: temple?.danhHieu ?? templeId,
        members: templeMembers.map((member) => ({
          id: member.id,
          label: memberLabel(member),
        })),
      })
    }

    return { ok: false, blockers }
  }

  await templeStore.deleteMany(input.ids)
  await Promise.allSettled(input.ids.map((id) => deletePhoto(id)))
  return { ok: true }
}
