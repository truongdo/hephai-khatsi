import {
  fixtures,
  lockedMember,
  grantDirectoryRoleMock,
  renderForm,
} from './MemberFormPage.testHarness'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { m } from '#/paraglide/messages'

describe('MemberFormPage directory role', () => {
  it('disables grant Thư ký when member email is not gmail', async () => {
    fixtures.member = { ...lockedMember, email: 'a@hephai.org' }
    renderForm({ mode: 'edit' })
    const grantBtn = await screen.findByRole('button', {
      name: m.admin_member_directory_role_grant(),
    })
    expect(grantBtn).toBeDisabled()
  })

  it('enables grant Thư ký when member email is gmail', async () => {
    fixtures.member = { ...lockedMember, email: 'user@gmail.com' }
    renderForm({ mode: 'edit' })
    const grantBtn = await screen.findByRole('button', {
      name: m.admin_member_directory_role_grant(),
    })
    expect(grantBtn).not.toBeDisabled()
  })

  it('shows both grant buttons when canGrant and no directoryRole', async () => {
    fixtures.member = { ...lockedMember, email: 'user@gmail.com' }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByRole('button', {
        name: m.admin_member_directory_role_grant(),
      }),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeTruthy()
  })

  it('grants he_phai_secretary via API when he phai grant clicked', async () => {
    const user = userEvent.setup()
    fixtures.member = { ...lockedMember, email: 'user@gmail.com' }
    grantDirectoryRoleMock.mockResolvedValue({ ok: true } as never)
    renderForm({ mode: 'edit' })
    await user.click(
      await screen.findByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    )
    await vi.waitFor(() =>
      expect(grantDirectoryRoleMock).toHaveBeenCalledWith({
        memberId: 'm1',
        role: 'he_phai_secretary',
        idToken: 'admin-id-token',
      }),
    )
  })

  it('shows Thư ký giáo đoàn badge and revoke when member has giao_doan_admin role', async () => {
    fixtures.member = {
      ...lockedMember,
      email: 'sec@gmail.com',
      directoryRole: 'giao_doan_admin',
    }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.admin_member_directory_role_badge()),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_revoke(),
      }),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeNull()
  })

  it('shows Thư ký hệ phái badge and revoke when member has he_phai_secretary role', async () => {
    fixtures.member = {
      ...lockedMember,
      email: 'sec@gmail.com',
      directoryRole: 'he_phai_secretary',
    }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.admin_member_directory_role_badge_he_phai()),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_revoke_he_phai(),
      }),
    ).toBeTruthy()
    const user = userEvent.setup()
    await user.click(
      screen.getByRole('button', {
        name: m.admin_member_directory_role_revoke_he_phai(),
      }),
    )
    const confirmDialog = await screen.findByRole('dialog', {
      name: m.admin_member_directory_role_revoke_he_phai(),
    })
    expect(
      within(confirmDialog).getByText(
        m.admin_org_units_he_phai_secretaries_revoke_confirm(),
      ),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeNull()
  })

  it('shows read-only badge without grant/revoke when viewer is he_phai_secretary', async () => {
    fixtures.adminClaim = {
      status: 'admin',
      uid: 'sec-uid',
      role: 'he_phai_secretary',
      orgUnitId: null,
    }
    fixtures.member = {
      ...lockedMember,
      email: 'sec@gmail.com',
      directoryRole: 'he_phai_secretary',
    }
    renderForm({ mode: 'edit' })
    expect(
      await screen.findByText(m.admin_member_directory_role_badge_he_phai()),
    ).toBeTruthy()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_revoke_he_phai(),
      }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', {
        name: m.admin_member_directory_role_grant_he_phai(),
      }),
    ).toBeNull()
  })
})
