import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import type { Member } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { RetreatRegistrationStatus } from './RetreatRegistrationStatus'

const member: Member = {
  id: 'm1',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'draft',
  theDanh: 'Thế A',
  phapDanh: 'Pháp A',
  ngaySinh: '1990-01-01',
  noiSinh: 'Hà Nội',
  cccd: '001234567890',
  dienThoai: '0901234567',
  email: '',
  diaChiThuongTru: 'Hà Nội',
  ngayXuatGia: '2010-01-01',
  noiXuatGia: 'Chùa A',
  hienTuHoc: '',
  bonSu: '',
  inviteId: 'retreat_r1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function baseRegistration(
  overrides: Partial<RetreatRegistration> = {},
): RetreatRegistration {
  return {
    id: 'r1_m1',
    retreatId: 'r1',
    memberId: 'm1',
    orgUnitId: 'gd-i',
    registeredVia: 'self',
    registeredBy: null,
    extraAnswers: {},
    status: 'pending',
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  }
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

function renderStatus(registration: RetreatRegistration) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <RetreatRegistrationStatus registration={registration} member={member} />
    </MantineProvider>,
  )
}

describe('RetreatRegistrationStatus', () => {
  it('shows pending status copy', () => {
    renderStatus(baseRegistration({ status: 'pending' }))
    expect(
      screen.getByRole('heading', { name: m.registration_status_pending_title() }),
    ).toBeTruthy()
    expect(screen.getByText(m.registration_status_pending_body())).toBeTruthy()
    expect(screen.getByText('Pháp A · Thế A')).toBeTruthy()
  })

  it('shows approved status copy', () => {
    renderStatus(
      baseRegistration({
        status: 'approved',
        approvedBy: 'admin-1',
        approvedAt: '2026-07-21T00:00:00.000Z',
      }),
    )
    expect(
      screen.getByRole('heading', { name: m.registration_status_approved_title() }),
    ).toBeTruthy()
    expect(screen.getByText(m.registration_status_approved_body())).toBeTruthy()
  })

  it('shows rejected status with reason', () => {
    renderStatus(
      baseRegistration({
        status: 'rejected',
        rejectionReason: 'Hồ sơ chưa đủ',
        approvedBy: 'admin-1',
        approvedAt: '2026-07-21T00:00:00.000Z',
      }),
    )
    expect(
      screen.getByRole('heading', { name: m.registration_status_rejected_title() }),
    ).toBeTruthy()
    expect(screen.getByText(m.registration_status_rejected_body())).toBeTruthy()
    expect(screen.getByText('Hồ sơ chưa đủ')).toBeTruthy()
  })
})
