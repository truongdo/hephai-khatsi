import { describe, expect, it } from 'vitest'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import {
  buildMemberPdfViewModel,
  MEMBER_PDF_EMPTY,
} from '#/domain/memberPdfViewModel'

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

function fieldValue(vm: ReturnType<typeof buildMemberPdfViewModel>, label: string): string | undefined {
  for (const section of vm.sections) {
    const hit = section.fields.find((f) => f.label === label)
    if (hit) return hit.value
    for (const block of section.blocks ?? []) {
      const bHit = block.fields.find((f) => f.label === label)
      if (bHit) return bHit.value
    }
  }
  return undefined
}

describe('buildMemberPdfViewModel', () => {
  it('uses em dash for empty fields and formats dates', () => {
    const vm = buildMemberPdfViewModel(
      member({
        id: 'm1',
        sanghaType: 'tang',
        phapDanh: 'Minh Tam',
        ngaySinh: '1990-01-15',
      }),
      { orgUnitNameById: { 'gd-i': 'Giáo đoàn I' } },
    )
    expect(vm.header.phapDanh).toBe('Minh Tam')
    expect(vm.header.orgUnitName).toBe('Giáo đoàn I')
    expect(vm.header.statusLabel).toBe(m.admin_members_status_draft())
    expect(fieldValue(vm, m.filler_field_ngay_sinh())).toBe('15-01-1990')
    expect(fieldValue(vm, m.filler_field_email())).toBe(MEMBER_PDF_EMPTY)
  })

  it('includes tang and ni precept sections with formatted dates', () => {
    const tang = buildMemberPdfViewModel(
      member({
        id: 'm1',
        sanghaType: 'tang',
        gioiTyKheo: { ngayGh: '2015-06-01' },
      }),
      { orgUnitNameById: {} },
    )
    const ni = buildMemberPdfViewModel(
      member({
        id: 'm2',
        sanghaType: 'ni',
        gioiTyKheoNi: { ngayGh: '2016-06-01' },
      }),
      { orgUnitNameById: {} },
    )
    expect(tang.sections.map((s) => s.title)).toContain(m.filler_section_gioi())
    expect(ni.sections.map((s) => s.title)).toContain(m.filler_section_gioi())
    expect(JSON.stringify(tang)).toContain('01-06-2015')
    expect(JSON.stringify(ni)).toContain('01-06-2016')
  })

  it('lists document attachment status without raw paths', () => {
    const vm = buildMemberPdfViewModel(
      member({
        id: 'm1',
        sanghaType: 'tang',
        documents: {
          cccd: {
            frontPath: 'members/m1/docs/cccd/front.jpg',
            backPath: 'members/m1/docs/cccd/back.jpg',
          },
        },
      }),
      { orgUnitNameById: {} },
    )
    const json = JSON.stringify(vm)
    expect(json).not.toContain('members/m1/docs')
    expect(fieldValue(vm, m.filler_doc_type_diep_sa_di()) ?? MEMBER_PDF_EMPTY).toBe(
      MEMBER_PDF_EMPTY,
    )
  })

  it('falls back org unit id when name missing', () => {
    const vm = buildMemberPdfViewModel(
      member({ id: 'm1', sanghaType: 'tang', orgUnitId: 'gd-x' }),
      { orgUnitNameById: {} },
    )
    expect(vm.header.orgUnitName).toBe('gd-x')
  })
})
