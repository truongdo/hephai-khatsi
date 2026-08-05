import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuditLogEntry } from '#/domain/auditLog'
import { m } from '#/paraglide/messages'
import { listAuditLogs } from '#/repositories/auditLogRepo'
import { theme } from '../../theme'
import { AuditHistoryModal, type AuditHistoryModalProps } from './AuditHistoryModal'

const listAuditLogsMock = vi.mocked(listAuditLogs)

vi.mock('#/repositories/auditLogRepo', () => ({
  listAuditLogs: vi.fn(),
}))

beforeAll(() => {
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
})

beforeEach(() => {
  listAuditLogsMock.mockReset()
})

function renderModal(overrides: Partial<AuditHistoryModalProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const props: AuditHistoryModalProps = {
    opened: true,
    onClose: () => {},
    title: 'A',
    parent: { collection: 'members', id: 'm1' },
    ...overrides,
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <AuditHistoryModal {...props} />
      </MantineProvider>
    </QueryClientProvider>,
  )
}

const updatedEntry: AuditLogEntry = {
  id: 'e1',
  action: 'updated',
  at: '2026-07-19T10:00:00.000Z',
  actorType: 'admin',
  actorId: 'admin-1',
  changes: [{ path: 'phapDanh', before: 'Old', after: 'New' }],
  summary: '1',
}

describe('AuditHistoryModal', () => {
  it('shows empty state', async () => {
    listAuditLogsMock.mockResolvedValue({ entries: [], nextStartAfterAt: null })
    renderModal()
    expect(await screen.findByText(/Chưa có lịch sử/)).toBeTruthy()
  })

  it('renders an entry with before → after', async () => {
    listAuditLogsMock.mockResolvedValue({
      entries: [updatedEntry],
      nextStartAfterAt: null,
    })
    renderModal()
    expect(await screen.findByText(/phapDanh/)).toBeTruthy()
    expect(screen.getByText(/Old/)).toBeTruthy()
    expect(screen.getByText(/New/)).toBeTruthy()
    expect(screen.getByText(m.admin_audit_action_updated())).toBeTruthy()
    expect(screen.getByText(/Admin · admin-1/)).toBeTruthy()
  })

  it('load more appends', async () => {
    const user = userEvent.setup()
    const firstPageEntry: AuditLogEntry = {
      id: 'e1',
      action: 'created',
      at: '2026-07-19T10:00:00.000Z',
      actorType: 'admin',
      actorId: 'admin-1',
      changes: [],
      summary: null,
    }
    const secondPageEntry: AuditLogEntry = {
      id: 'e2',
      action: 'locked',
      at: '2026-07-18T10:00:00.000Z',
      actorType: 'filler',
      actorId: 'filler-1',
      changes: [],
      summary: null,
    }

    listAuditLogsMock
      .mockResolvedValueOnce({
        entries: [firstPageEntry],
        nextStartAfterAt: '2026-07-18T10:00:00.000Z',
      })
      .mockResolvedValueOnce({
        entries: [secondPageEntry],
        nextStartAfterAt: null,
      })

    renderModal()
    expect(await screen.findByText(m.admin_audit_action_created())).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: m.admin_audit_load_more() }),
    )
    await waitFor(() => {
      expect(screen.getByText(m.admin_audit_action_locked())).toBeTruthy()
      expect(screen.getByText(/Filler · filler-1/)).toBeTruthy()
    })
    expect(listAuditLogsMock).toHaveBeenCalledTimes(2)
    expect(listAuditLogsMock).toHaveBeenLastCalledWith(
      { collection: 'members', id: 'm1' },
      { limit: 20, startAfterAt: '2026-07-18T10:00:00.000Z' },
    )
  })
})
