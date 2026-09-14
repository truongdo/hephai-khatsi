import { describe, expect, it } from 'vitest'
import { MEMBER_PDF_EMPTY, type MemberPdfViewModel } from '#/domain/memberPdfViewModel'
import { renderMembersPdfBlob } from '#/components/admin/pdf/renderMemberPdf'

const sampleVm: MemberPdfViewModel = {
  memberId: 'm1',
  header: {
    phapDanh: 'Minh Tam',
    theDanh: 'Nguyen A',
    sanghaLabel: 'Tăng',
    orgUnitName: 'GD I',
    statusLabel: 'Nháp',
  },
  sections: [
    {
      title: 'Định danh',
      fields: [{ label: 'Email', value: MEMBER_PDF_EMPTY }],
    },
  ],
}

describe('renderMembersPdfBlob', () => {
  it('returns a non-empty PDF blob for one member', async () => {
    const blob = await renderMembersPdfBlob([
      { viewModel: sampleVm, portraitDataUrl: null },
    ])
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(100)
  }, 30_000)

  it('returns a PDF blob for two members', async () => {
    const second = {
      ...sampleVm,
      memberId: 'm2',
      header: { ...sampleVm.header, phapDanh: 'Other' },
    }
    const blob = await renderMembersPdfBlob([
      { viewModel: sampleVm, portraitDataUrl: null },
      { viewModel: second, portraitDataUrl: null },
    ])
    expect(blob.size).toBeGreaterThan(100)
  }, 30_000)
})
