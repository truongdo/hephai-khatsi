import { describe, expect, it } from 'vitest'
import {
  documentSidesKept,
  droppedFiles,
  foreignMemberFiles,
  foreignTempleFiles,
  memberFilePaths,
  moveMemberFiles,
  templeFilePaths,
} from './recordFiles'

const documents = {
  cccd: { frontPath: 'members/a/docs/cccd/front.jpg', backPath: 'members/a/docs/cccd/back.png' },
  diep_sa_di: { filePath: 'members/a/docs/diep_sa_di/file.pdf' },
}

describe('memberFilePaths', () => {
  it('lists the portrait and every document side', () => {
    expect(memberFilePaths({ photoPath: 'members/a/photo.jpg', documents })).toEqual([
      'members/a/photo.jpg',
      'members/a/docs/cccd/front.jpg',
      'members/a/docs/cccd/back.png',
      'members/a/docs/diep_sa_di/file.pdf',
    ])
  })

  it('is empty without files', () => {
    expect(memberFilePaths({ photoPath: null })).toEqual([])
    expect(templeFilePaths({ photoPath: null })).toEqual([])
  })
})

describe('droppedFiles', () => {
  it('keeps a path that is replaced in place', () => {
    expect(droppedFiles(['members/a/p.jpg', 'members/a/d.jpg'], ['members/a/p.jpg', 'members/a/d.pdf'], 'members/a/')).toEqual([
      'members/a/d.jpg',
    ])
  })

  it('never names a file outside the record folder', () => {
    expect(droppedFiles(['members/other/photo.jpg', 'members/ab/photo.jpg'], [], 'members/a/')).toEqual([])
  })
})

describe('documentSidesKept', () => {
  it('allows replacing a side with another file', () => {
    expect(
      documentSidesKept(documents, {
        ...documents,
        cccd: { ...documents.cccd, frontPath: 'members/a/docs/cccd/front.pdf' },
      }),
    ).toBe(true)
  })

  it('allows adding a side', () => {
    expect(documentSidesKept({}, documents)).toBe(true)
  })

  it('refuses removing a side or a type', () => {
    expect(documentSidesKept(documents, { ...documents, cccd: { frontPath: documents.cccd.frontPath } })).toBe(false)
    expect(documentSidesKept(documents, { cccd: documents.cccd })).toBe(false)
  })
})

describe('moveMemberFiles', () => {
  it('moves the files under the old id to the new id', () => {
    const { member, moves } = moveMemberFiles(
      { photoPath: 'members/a/photo.jpg', documents: { cccd: documents.cccd } },
      'a',
      'b',
    )
    expect(member).toEqual({
      photoPath: 'members/b/photo.jpg',
      documents: {
        cccd: { frontPath: 'members/b/docs/cccd/front.jpg', backPath: 'members/b/docs/cccd/back.png' },
      },
    })
    expect(moves).toEqual([
      { from: 'members/a/docs/cccd/front.jpg', to: 'members/b/docs/cccd/front.jpg' },
      { from: 'members/a/docs/cccd/back.png', to: 'members/b/docs/cccd/back.png' },
      { from: 'members/a/photo.jpg', to: 'members/b/photo.jpg' },
    ])
  })

  it('leaves paths outside the old folder and records without files', () => {
    expect(moveMemberFiles({ photoPath: 'members/x/photo.jpg' }, 'a', 'b')).toEqual({
      member: { photoPath: 'members/x/photo.jpg', documents: undefined },
      moves: [],
    })
  })
})

describe('foreignMemberFiles / foreignTempleFiles', () => {
  it('accepts only the keys the upload routes write for the owner', () => {
    expect(
      foreignMemberFiles(
        null,
        {
          photoPath: 'members/a/photo.jpg',
          documents: {
            cccd: { frontPath: 'members/a/docs/cccd/front.png', backPath: 'members/a/docs/cccd/front.png' },
            diep_sa_di: { filePath: 'members/a/docs/diep_sa_di/file.pdf' },
          },
        },
        'a',
      ),
    ).toEqual(['members/a/docs/cccd/front.png'])
    expect(foreignMemberFiles(null, { photoPath: 'members/b/photo.jpg' }, 'a')).toEqual(['members/b/photo.jpg'])
    expect(foreignTempleFiles(null, { photoPath: 'temples/t/photo.jpg' }, 't')).toEqual([])
    expect(foreignTempleFiles(null, { photoPath: 'temples/t/photo-ab12.jpg' }, 't')).toEqual([])
    expect(foreignMemberFiles(null, { photoPath: 'members/a/photo-x/../b.jpg' }, 'a')).toEqual([
      'members/a/photo-x/../b.jpg',
    ])
    expect(
      foreignMemberFiles(null, { photoPath: null, documents: { cccd: { backPath: 'members/a/docs/cccd/back-9f.pdf' } } }, 'a'),
    ).toEqual([])
    expect(foreignTempleFiles(null, { photoPath: 'temples/t/x.svg' }, 't')).toEqual(['temples/t/x.svg'])
  })

  it('ignores paths the record already had (older data)', () => {
    const legacy = { photoPath: 'members/old-id/photo.jpg' }
    expect(foreignMemberFiles(legacy, legacy, 'a')).toEqual([])
  })
})
