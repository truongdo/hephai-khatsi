import { describe, expect, it } from 'vitest'
import { createMemoryTempleStore, createMemoryMemberStore } from '#/test/memoryStores'

describe('list sort keys on write', () => {
  it('temple draft write stores listCityName and orgUnitName', async () => {
    const store = createMemoryTempleStore([])
    const { temple } = await store.createOrUpdateDraft({
      orgUnitId: 'gd-i',
      inviteId: null,
      managerPhones: ['0901234567'],
      patch: {
        diaChiMoi: {
          cityCode: '01',
          cityName: 'Huế',
          wardCode: 'w',
          wardName: 'P',
        },
        danhHieu: 'TX Test',
      },
    })
    expect(temple.listCityName).toBe('Huế')
    expect(temple.orgUnitName).toBe('Giáo đoàn I')
  })

  it('member draft write stores rank order, orgUnitName, and sapXepHaLap', async () => {
    const store = createMemoryMemberStore([])
    const { member } = await store.createOrUpdateDraft({
      orgUnitId: 'gd-ii',
      sanghaType: 'tang',
      inviteId: null,
      cccd: '001234567890',
      patch: {
        giaoPhamHePhai: { rank: 'sa_di' },
        phapDanh: 'A',
        gioiTyKheo: { ngayHePhai: '2010-01-01' },
        gioiSaDi: { ngayHePhai: '2009-01-01' },
        ngayXuatGia: '2008-01-01',
      },
    })
    expect(member.orgUnitName).toBe('Giáo đoàn II')
    expect(member.giaoPhamHePhaiRankOrder).toBe(4)
    expect(member.sapXepHaLap).toBe('sa_di:2010-01-01:2009-01-01:2008-01-01')
  })
})
