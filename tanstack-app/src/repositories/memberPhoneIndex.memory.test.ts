import { describe, expect, it } from 'vitest'
import { normalizeVnPhone } from '#/domain/normalize'
import { createMemoryMemberStore } from '#/test/memoryStores'

describe('member phone index (memory store)', () => {
  it('indexes dienThoai and lists members by org/sangha/phone', async () => {
    const store = createMemoryMemberStore()
    const phone = normalizeVnPhone('0901 234 567')
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      inviteId: 'public',
      cccd: '012345678901',
      patch: { dienThoai: phone, phapDanh: 'Minh Tam' },
    })

    const found = await store.listByOrgSanghaAndPhone({
      orgUnitId: 'gd-i',
      sanghaType: 'tang',
      phone,
    })
    expect(found.map((m) => m.id)).toEqual([member.id])

    const wrongSangha = await store.listByOrgSanghaAndPhone({
      orgUnitId: 'gd-i',
      sanghaType: 'ni',
      phone,
    })
    expect(wrongSangha).toEqual([])
  })
})
