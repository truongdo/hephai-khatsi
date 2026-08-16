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
