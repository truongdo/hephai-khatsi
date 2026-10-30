import JSZip from 'jszip'
import {
  renderMembersPdfBlob,
  type MemberPdfRenderInput,
} from '#/components/admin/pdf/renderMemberPdf'
import { getMemberDocumentDownloadUrl } from '#/components/filler/memberDocumentUrl'
import { getMemberPhotoDownloadUrl } from '#/components/filler/memberPhotoUrl'
import { downloadBlob } from '#/domain/downloadBlob'
import {
  extFromObjectKeyOrType,
  memberPdfFilename,
  memberPdfZipDocEntry,
  memberPdfZipFolder,
  membersMergedPdfFilename,
  membersPdfZipFilename,
} from '#/domain/memberPdfNames'
import {
  MEMBER_DOCUMENT_TYPES,
  type DocumentSide,
} from '#/domain/memberDocumentTypes'
import { buildMemberPdfViewModel } from '#/domain/memberPdfViewModel'
import type { Member, RecordStatus, SanghaType } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type MembersPdfFormat = 'merged_pdf' | 'zip'

export type ExportMembersPdfProgress = {
  done: number
  total: number
}

export type ExportMembersPdfInput = {
  members?: Member[]
  memberIds?: string[]
  listAll?: {
    sanghaType: SanghaType
    orgUnitId?: string
    status?: RecordStatus
    haLapTabRank: string
  }
  format: MembersPdfFormat
  orgUnitNameById: Record<string, string>
  filenameOverride?: string
  onProgress?: (progress: ExportMembersPdfProgress) => void
}

export type ExportMembersPdfResult = {
  filename: string
  failedDocumentCount: number
}

export type ExportMembersPdfDeps = {
  downloadBlob: typeof downloadBlob
  renderMembersPdfBlob: typeof renderMembersPdfBlob
  fetchPhoto: (photoPath: string) => Promise<string | null>
  fetchDocument: (
    filePath: string,
  ) => Promise<{ bytes: Uint8Array; contentType: string | null } | null>
  memberStore: Pick<MemberStore, 'getById' | 'listByHaLapTab'>
}

type DocumentEntry = {
  typeId: string
  side: DocumentSide
  path: string
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

async function defaultFetchPhoto(photoPath: string): Promise<string | null> {
  try {
    const url = getMemberPhotoDownloadUrl(photoPath)
    const response = await fetch(url)
    if (!response.ok) return null
    return blobToDataUrl(await response.blob())
  } catch {
    return null
  }
}

async function defaultFetchDocument(
  filePath: string,
): Promise<{ bytes: Uint8Array; contentType: string | null } | null> {
  try {
    const url = getMemberDocumentDownloadUrl(filePath)
    const response = await fetch(url)
    if (!response.ok) return null
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      contentType: response.headers.get('content-type'),
    }
  } catch {
    return null
  }
}

async function listAllByHaLapTab(
  store: Pick<MemberStore, 'listByHaLapTab'>,
  input: {
    sanghaType: SanghaType
    orgUnitId?: string
    status?: RecordStatus
    haLapTabRank: string
  },
): Promise<Member[]> {
  const all: Member[] = []
  let cursor: string | undefined
  for (;;) {
    const page = await store.listByHaLapTab({ ...input, limit: 50, cursor })
    all.push(...page.items)
    if (!page.nextCursor) break
    cursor = page.nextCursor
  }
  return all
}

async function resolveMembers(
  input: ExportMembersPdfInput,
  store: Pick<MemberStore, 'getById' | 'listByHaLapTab'>,
): Promise<Member[]> {
  if (input.members) return input.members

  if (input.memberIds) {
    const members: Member[] = []
    for (const memberId of input.memberIds) {
      const found = await store.getById(memberId)
      if (found) members.push(found)
    }
    return members
  }

  if (input.listAll) {
    return listAllByHaLapTab(store, input.listAll)
  }

  return []
}

function documentEntries(member: Member): DocumentEntry[] {
  const documents = member.documents ?? {}
  const entries: DocumentEntry[] = []

  for (const type of MEMBER_DOCUMENT_TYPES) {
    const files = documents[type.id]
    if (!files) continue

    if (type.sides === 'frontBack') {
      if (files.frontPath) {
        entries.push({ typeId: type.id, side: 'front', path: files.frontPath })
      }
      if (files.backPath) {
        entries.push({ typeId: type.id, side: 'back', path: files.backPath })
      }
      continue
    }

    if (files.filePath) {
      entries.push({ typeId: type.id, side: 'file', path: files.filePath })
    }
  }

  return entries
}

async function buildRenderInput(
  member: Member,
  orgUnitNameById: Record<string, string>,
  fetchPhoto: ExportMembersPdfDeps['fetchPhoto'],
): Promise<MemberPdfRenderInput> {
  let portraitDataUrl: string | null = null
  if (member.photoPath) {
    portraitDataUrl = await fetchPhoto(member.photoPath)
  }

  return {
    viewModel: buildMemberPdfViewModel(member, { orgUnitNameById }),
    portraitDataUrl,
  }
}

async function addMemberDocumentsToZip(
  zip: JSZip,
  member: Member,
  fetchDocument: ExportMembersPdfDeps['fetchDocument'],
): Promise<number> {
  const folder = memberPdfZipFolder(member)
  let failedDocumentCount = 0

  for (const entry of documentEntries(member)) {
    const fetched = await fetchDocument(entry.path)
    if (!fetched) {
      failedDocumentCount += 1
      continue
    }

    const ext = extFromObjectKeyOrType(entry.path, fetched.contentType)
    const zipPath = memberPdfZipDocEntry(folder, entry.typeId, entry.side, ext)
    zip.file(zipPath, fetched.bytes)
  }

  return failedDocumentCount
}

export async function exportMembersPdf(
  input: ExportMembersPdfInput,
  deps: Partial<ExportMembersPdfDeps> = {},
): Promise<ExportMembersPdfResult> {
  const {
    downloadBlob: download,
    renderMembersPdfBlob: renderPdf,
    fetchPhoto,
    fetchDocument,
    memberStore,
  }: ExportMembersPdfDeps = {
    downloadBlob,
    renderMembersPdfBlob,
    fetchPhoto: defaultFetchPhoto,
    fetchDocument: defaultFetchDocument,
    memberStore: memberRepo,
    ...deps,
  }

  const members = await resolveMembers(input, memberStore)
  if (members.length === 0) {
    throw new Error('EMPTY_EXPORT')
  }

  const total = members.length
  let failedDocumentCount = 0

  if (input.format === 'merged_pdf') {
    const renderInputs: MemberPdfRenderInput[] = []
    for (let index = 0; index < members.length; index += 1) {
      renderInputs.push(
        await buildRenderInput(members[index]!, input.orgUnitNameById, fetchPhoto),
      )
      input.onProgress?.({ done: index + 1, total })
    }

    const blob = await renderPdf(renderInputs)
    const filename =
      input.filenameOverride ??
      (members.length === 1
        ? memberPdfFilename(members[0]!)
        : membersMergedPdfFilename())
    download(blob, filename)
    return { filename, failedDocumentCount: 0 }
  }

  const zip = new JSZip()
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index]!
    const renderInput = await buildRenderInput(
      member,
      input.orgUnitNameById,
      fetchPhoto,
    )
    const pdfBlob = await renderPdf([renderInput])
    const folder = memberPdfZipFolder(member)
    zip.file(`${folder}/HoSo.pdf`, await pdfBlob.arrayBuffer())
    failedDocumentCount += await addMemberDocumentsToZip(zip, member, fetchDocument)
    input.onProgress?.({ done: index + 1, total })
  }

  const filename = input.filenameOverride ?? membersPdfZipFilename()
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  download(zipBlob, filename)
  return { filename, failedDocumentCount }
}
