import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import {
  memberPdfZipDocEntry,
  memberPdfZipFolder,
} from '#/domain/memberPdfNames'
import type { Member } from '#/domain/types'
import type { MemberPdfRenderInput } from '#/components/admin/pdf/renderMemberPdf'
import {
  exportMembersPdf,
  type ExportMembersPdfDeps,
} from './exportMembersPdf'

function member(overrides: Partial<Member> & Pick<Member, 'id' | 'sanghaType'>): Member {
  return {
    orgUnitId: 'gd-i',
    status: 'draft',
    cccd: '012345678901',
    inviteId: null,
    currentTempleId: null,
    photoPath: null,
    createdAt: '2026-07-19T00:00:00.000Z',
    updatedAt: '2026-07-19T00:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    editRequestedAt: null,
    editRequestedBy: null,
    ...overrides,
  }
}

function createDeps(
  overrides: Partial<ExportMembersPdfDeps> = {},
): ExportMembersPdfDeps & {
  downloads: Array<{ blob: Blob; filename: string }>
  renderCalls: MemberPdfRenderInput[][]
} {
  const downloads: Array<{ blob: Blob; filename: string }> = []
  const renderCalls: MemberPdfRenderInput[][] = []

  return {
    downloads,
    renderCalls,
    downloadBlob(blob, filename) {
      downloads.push({ blob, filename })
    },
    async renderMembersPdfBlob(inputs) {
      renderCalls.push(inputs)
      return new Blob(['pdf'], { type: 'application/pdf' })
    },
    async fetchPhoto() {
      return 'data:image/jpeg;base64,abc'
    },
    async fetchDocument() {
      return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' }
    },
    memberStore: {
      async getById() {
        return null
      },
      async listByHaLapTab() {
        return { items: [], nextCursor: null }
      },
    },
    ...overrides,
  }
}

describe('exportMembersPdf', () => {
  it('downloads a single merged PDF with filenameOverride', async () => {
    const m = member({ id: 'm1', sanghaType: 'tang', phapDanh: 'Minh Tam' })
    const deps = createDeps()

    const result = await exportMembersPdf(
      {
        members: [m],
        format: 'merged_pdf',
        orgUnitNameById: { 'gd-i': 'Giáo đoàn I' },
        filenameOverride: 'custom.pdf',
      },
      deps,
    )

    expect(result).toEqual({ filename: 'custom.pdf', failedDocumentCount: 0 })
    expect(deps.downloads).toHaveLength(1)
    expect(deps.downloads[0]?.filename).toBe('custom.pdf')
    expect(deps.renderCalls).toHaveLength(1)
    expect(deps.renderCalls[0]).toHaveLength(1)
    expect(deps.renderCalls[0]?.[0]?.viewModel.memberId).toBe('m1')
  })

  it('builds a ZIP for two members and counts failed document fetches', async () => {
    const m1 = member({
      id: 'm1',
      sanghaType: 'tang',
      phapDanh: 'A',
      documents: {
        cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
      },
    })
    const m2 = member({
      id: 'm2',
      sanghaType: 'tang',
      phapDanh: 'B',
      documents: {
        cccd: { frontPath: 'members/m2/docs/cccd/front.jpg' },
      },
    })

    const deps = createDeps({
      async fetchDocument(filePath) {
        if (filePath.includes('m2')) return null
        return { bytes: new Uint8Array([9]), contentType: 'image/jpeg' }
      },
    })

    const result = await exportMembersPdf(
      {
        members: [m1, m2],
        format: 'zip',
        orgUnitNameById: {},
      },
      deps,
    )

    expect(result.failedDocumentCount).toBe(1)
    expect(deps.downloads).toHaveLength(1)
    expect(deps.downloads[0]?.filename).toMatch(/^HoSoMembers_\d{4}-\d{2}-\d{2}\.zip$/)
    expect(deps.renderCalls).toHaveLength(2)

    const zip = await JSZip.loadAsync(await deps.downloads[0]!.blob.arrayBuffer())
    const folder1 = memberPdfZipFolder(m1)
    const folder2 = memberPdfZipFolder(m2)
    expect(zip.file(`${folder1}/HoSo.pdf`)).toBeTruthy()
    expect(zip.file(`${folder2}/HoSo.pdf`)).toBeTruthy()
    expect(
      zip.file(
        memberPdfZipDocEntry(folder1, 'cccd', 'front', 'jpg'),
      ),
    ).toBeTruthy()
    expect(
      zip.file(
        memberPdfZipDocEntry(folder2, 'cccd', 'front', 'jpg'),
      ),
    ).toBeNull()
  })

  it('throws EMPTY_EXPORT when listAll resolves no members', async () => {
    const deps = createDeps({
      memberStore: {
        async getById() {
          return null
        },
        async listByHaLapTab() {
          return { items: [], nextCursor: null }
        },
      },
    })

    await expect(
      exportMembersPdf(
        {
          listAll: {
            sanghaType: 'tang',
            haLapTabRank: '1',
          },
          format: 'merged_pdf',
          orgUnitNameById: {},
        },
        deps,
      ),
    ).rejects.toThrow('EMPTY_EXPORT')
  })

  it('renders with portraitDataUrl null when photo fetch fails', async () => {
    const m = member({
      id: 'm1',
      sanghaType: 'tang',
      photoPath: 'members/m1/photo.jpg',
    })
    const deps = createDeps({
      fetchPhoto: vi.fn(async () => null),
    })

    await exportMembersPdf(
      {
        members: [m],
        format: 'merged_pdf',
        orgUnitNameById: {},
      },
      deps,
    )

    expect(deps.fetchPhoto).toHaveBeenCalledWith('members/m1/photo.jpg')
    expect(deps.renderCalls[0]?.[0]?.portraitDataUrl).toBeNull()
  })
})
