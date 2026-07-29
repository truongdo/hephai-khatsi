import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'
import { deleteMemberDocument } from '#/use-cases/deleteMemberDocument'
import { uploadMemberDocument } from '#/use-cases/uploadMemberDocument'
import { theme } from '../../theme'
import { documentTypeLabel } from './memberDocumentLabels'
import { getMemberDocumentDownloadUrl } from './memberDocumentUrl'
import {
  MemberDocumentsField,
  type MemberDocumentsFieldProps,
  type PendingDocumentFiles,
} from './MemberDocumentsField'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'

vi.mock('#/use-cases/uploadMemberDocument', () => ({
  uploadMemberDocument: vi.fn(),
}))

vi.mock('#/use-cases/deleteMemberDocument', () => ({
  deleteMemberDocument: vi.fn(),
}))

vi.mock('./memberDocumentUrl', () => ({
  getMemberDocumentDownloadUrl: vi.fn(
    (path: string) => `https://cdn.example/${path}`,
  ),
}))

const uploadMemberDocumentMock = vi.mocked(uploadMemberDocument)
const deleteMemberDocumentMock = vi.mocked(deleteMemberDocument)
const getMemberDocumentDownloadUrlMock = vi.mocked(getMemberDocumentDownloadUrl)

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })

  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

beforeEach(() => {
  uploadMemberDocumentMock.mockReset()
  deleteMemberDocumentMock.mockReset()
  getMemberDocumentDownloadUrlMock.mockClear()
})

function renderField(props: Partial<MemberDocumentsFieldProps> = {}) {
  const onDocumentsChange = vi.fn()
  const onPendingFilesChange = vi.fn()

  const defaultProps: MemberDocumentsFieldProps = {
    cccd: '123456789012',
    documents: {},
    onDocumentsChange,
    pendingFiles: {},
    onPendingFilesChange,
    ...props,
  }

  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <MemberDocumentsField {...defaultProps} />
    </MantineProvider>,
  )

  return { onDocumentsChange, onPendingFilesChange }
}

function renderStatefulField(
  props: Partial<MemberDocumentsFieldProps> = {},
) {
  function StatefulWrapper() {
    const [documents, setDocuments] = useState<MemberDocuments>(
      props.documents ?? {},
    )
    const [pendingFiles, setPendingFiles] = useState<PendingDocumentFiles>(
      props.pendingFiles ?? {},
    )

    return (
      <MemberDocumentsField
        cccd="123456789012"
        documents={documents}
        onDocumentsChange={setDocuments}
        pendingFiles={pendingFiles}
        onPendingFilesChange={setPendingFiles}
        {...props}
      />
    )
  }

  render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <StatefulWrapper />
    </MantineProvider>,
  )
}

async function openDocTypeSelect(user: ReturnType<typeof userEvent.setup>) {
  const select = screen.getByRole('combobox', {
    name: m.filler_doc_select_label(),
  })
  await user.click(select)
  return select
}

async function pickDocType(
  user: ReturnType<typeof userEvent.setup>,
  typeId: Parameters<typeof documentTypeLabel>[0],
) {
  await openDocTypeSelect(user)
  await user.click(await screen.findByText(documentTypeLabel(typeId)))
}

function getFileInputs() {
  return Array.from(
    document.querySelectorAll('input[type="file"]'),
  ) as HTMLInputElement[]
}

describe('MemberDocumentsField', () => {
  it('hides used types from the select', async () => {
    const user = userEvent.setup()
    renderField({
      documents: {
        cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
      },
    })

    await openDocTypeSelect(user)

    const select = screen.getByRole('combobox', {
      name: m.filler_doc_select_label(),
    })
    const listboxId = select.getAttribute('aria-controls')
    expect(listboxId).toBeTruthy()
    const listbox = document.getElementById(listboxId!)
    expect(listbox?.textContent).not.toContain(documentTypeLabel('cccd'))
    expect(listbox?.textContent).toContain(documentTypeLabel('diep_sa_di'))
  })

  it('shows front/back slots for cccd', async () => {
    const user = userEvent.setup()
    renderField()

    await pickDocType(user, 'cccd')

    expect(screen.getByText(m.filler_doc_side_front())).toBeTruthy()
    expect(screen.getByText(m.filler_doc_side_back())).toBeTruthy()
    expect(screen.getAllByRole('button', { name: m.filler_doc_choose_file() }))
      .toHaveLength(2)
  })

  it('stores pending file when memberId is missing', async () => {
    const user = userEvent.setup()
    renderStatefulField()
    const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })

    await pickDocType(user, 'diep_sa_di')
    const [fileInput] = getFileInputs()
    await user.upload(fileInput, file)

    expect(uploadMemberDocumentMock).not.toHaveBeenCalled()
    expect(screen.getByText(m.filler_doc_attached_heading())).toBeTruthy()
    expect(screen.getByText(documentTypeLabel('diep_sa_di'))).toBeTruthy()
  })

  it('with memberId: uploads immediately and updates documents', async () => {
    uploadMemberDocumentMock.mockResolvedValue({
      filePath: 'members/m1/docs/cccd/front.jpg',
      documents: {
        cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
      },
    })
    const user = userEvent.setup()
    const { onDocumentsChange, onPendingFilesChange } = renderField({
      memberId: 'm1',
    })
    const file = new File(['jpeg'], 'front.jpg', { type: 'image/jpeg' })

    await pickDocType(user, 'cccd')
    const [fileInput] = getFileInputs()
    await user.upload(fileInput, file)

    expect(uploadMemberDocumentMock).toHaveBeenCalledOnce()
    expect(uploadMemberDocumentMock).toHaveBeenCalledWith({
      memberId: 'm1',
      cccd: '123456789012',
      typeId: 'cccd',
      side: 'front',
      bytes: expect.any(Uint8Array),
      contentType: 'image/jpeg',
      inviteToken: undefined,
      idToken: undefined,
      current: {},
    })
    expect(onDocumentsChange).toHaveBeenCalledWith({
      cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
    })
    expect(onPendingFilesChange).not.toHaveBeenCalled()
  })

  it('rejects invalid file type with filler_doc_invalid_type', async () => {
    const user = userEvent.setup()
    const { onPendingFilesChange } = renderField()

    await pickDocType(user, 'diep_sa_di')
    const [fileInput] = getFileInputs()
    const file = new File(['gif'], 'doc.gif', { type: 'image/gif' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(screen.getByText(m.filler_doc_invalid_type())).toBeTruthy()
    expect(onPendingFilesChange).not.toHaveBeenCalled()
    expect(uploadMemberDocumentMock).not.toHaveBeenCalled()
  })

  it('renders attached types as cards with filename links and missing sides', () => {
    renderField({
      documents: {
        cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
      },
    })

    expect(screen.getByText(m.filler_doc_attached_heading())).toBeTruthy()
    expect(screen.getByText(documentTypeLabel('cccd'))).toBeTruthy()
    expect(
      screen.getByRole('link', { name: 'front.jpg' }),
    ).toHaveAttribute('href', 'https://cdn.example/members/m1/docs/cccd/front.jpg')
    expect(screen.getByText(m.filler_doc_side_front())).toBeTruthy()
    expect(screen.getByText(m.filler_doc_side_back())).toBeTruthy()
    expect(screen.getByText(m.filler_doc_missing())).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.filler_doc_choose_file() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.filler_doc_replace() }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: m.filler_doc_remove() }),
    ).toBeTruthy()
  })

  it('hides edit actions and missing-side slots when disabled', () => {
    renderField({
      disabled: true,
      documents: {
        cccd: { frontPath: 'members/m1/docs/cccd/front.jpg' },
      },
    })

    expect(screen.getByRole('link', { name: 'front.jpg' })).toBeTruthy()
    expect(screen.queryByText(m.filler_doc_missing())).toBeNull()
    expect(
      screen.queryByRole('button', { name: m.filler_doc_remove() }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: m.filler_doc_replace() }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: m.filler_doc_choose_file() }),
    ).toBeNull()
  })
})
