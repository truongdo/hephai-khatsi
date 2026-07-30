import React from 'react'
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { RegistrationRouteProvider } from '#/components/registration/registrationRouteContext'
import type { Invite } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { theme } from '../theme'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: Record<string, unknown>) => ({
    options,
    path,
    useSearch: () => ({ phone: '0901234567' }),
    useNavigate: () => navigateMock,
  }),
}))

vi.mock('#/components/filler/MemberEditorForm', () => ({
  MemberEditorForm: () => <div data-testid="member-editor-form" />,
}))

const invite: Invite = {
  id: 'inv-1',
  token: 'tok',
  createdAt: '2026-07-01T00:00:00.000Z',
  createdBy: 'admin-1',
  kind: 'retreat_registration',
  retreatId: 'r1',
  orgUnitId: 'gd-i',
  disabled: false,
}

const openRetreat = {
  id: 'r1',
  type: 'giao_doan' as const,
  orgUnitId: 'gd-i',
  name: 'Khóa tu mùa hè',
  diaDiem: 'Chùa A',
  noiDung: 'Nội dung',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T08:00:00.000Z',
  thoiGianKetThuc: '2026-08-10T18:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-31T23:59:00.000Z',
  extraFields: [],
  quyenDangKy: 'both' as const,
  status: 'open' as const,
  createdBy: 'admin-uid',
  createdAt: '2026-07-19T10:00:00.000Z',
  updatedAt: '2026-07-19T10:00:00.000Z',
}

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
})

afterEach(() => {
  cleanup()
})

async function renderMemberNewRoute(
  retreat = openRetreat,
) {
  const { Route } = await import('./r.$token.member.new')
  const Component = Route.options.component as React.ComponentType

  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <RegistrationRouteProvider value={{ token: 'tok', invite, retreat }}>
        <Component />
      </RegistrationRouteProvider>
    </MantineProvider>,
  )
}

describe('RegistrationMemberNewRoute', () => {
  it('renders new-member form when self registration is open', async () => {
    await renderMemberNewRoute()

    expect(screen.getByText(m.registration_member_new_sangha_label())).toBeTruthy()
    expect(screen.queryByTestId('member-editor-form')).toBeNull()
  })

  it('shows gate alert instead of form when retreat registration is closed', async () => {
    await renderMemberNewRoute({ ...openRetreat, status: 'closed' })

    expect(await screen.findByText(m.registration_gate_closed())).toBeTruthy()
    expect(screen.queryByText(m.registration_member_new_sangha_label())).toBeNull()
    expect(screen.queryByTestId('member-editor-form')).toBeNull()
  })
})
