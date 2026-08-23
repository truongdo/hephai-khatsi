import { describe, expect, it } from 'vitest'
import { buildMemberPatch, emptyMemberDraft } from './memberDraft'

describe('memberDraft phanDoan', () => {
  it('hydrates from member and patches non-empty value', () => {
    const draft = emptyMemberDraft({ phanDoan: 'Phân đoàn 3' })
    expect(draft.phanDoan).toBe('Phân đoàn 3')
    expect(buildMemberPatch(draft).phanDoan).toBe('Phân đoàn 3')
  })

  it('omits empty phanDoan from patch', () => {
    const draft = emptyMemberDraft()
    expect(draft.phanDoan).toBe('')
    expect(buildMemberPatch(draft).phanDoan).toBeUndefined()
  })
})

describe('memberDraft ngayHaCapHaLap', () => {
  it('stays undefined when empty even if precept / xuat gia dates exist', () => {
    const draft = emptyMemberDraft({
      gioiTyKheo: { ngayHePhai: '2018-06-15' },
      ngayXuatGia: '2005-03-01',
    })
    expect(draft.ngayHaCapHaLap).toBe('')
    expect(buildMemberPatch(draft).ngayHaCapHaLap).toBeUndefined()
  })

  it('preserves existing ngayHaCapHaLap when set', () => {
    const draft = emptyMemberDraft({
      ngayHaCapHaLap: '1999-12-31',
      gioiTyKheo: { ngayHePhai: '2018-06-15' },
    })
    expect(buildMemberPatch(draft).ngayHaCapHaLap).toBe('1999-12-31')
  })
})

describe('memberDraft theDanh / phapDanh', () => {
  it('hydrates and patches uppercase values', () => {
    const draft = emptyMemberDraft({
      theDanh: 'nguyễn văn a',
      phapDanh: 'minh tâm',
    })
    expect(draft.theDanh).toBe('NGUYỄN VĂN A')
    expect(draft.phapDanh).toBe('MINH TÂM')
    expect(buildMemberPatch(draft)).toMatchObject({
      theDanh: 'NGUYỄN VĂN A',
      phapDanh: 'MINH TÂM',
    })
  })

  it('trims whitespace before uppercasing on save', () => {
    const draft = emptyMemberDraft()
    draft.theDanh = '  nguyễn văn a  '
    draft.phapDanh = '  minh tâm  '
    expect(buildMemberPatch(draft)).toMatchObject({
      theDanh: 'NGUYỄN VĂN A',
      phapDanh: 'MINH TÂM',
    })
  })
})
