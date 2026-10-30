import { describe, expect, it } from 'vitest'
import { isAdminNavItemActive } from './adminNavActive'

const navTos = [
  '/admin/temples',
  '/admin/members/tang',
  '/admin/members/ni',
  '/admin/members/stats',
  '/admin/temples/stats',
  '/admin/org-units',
] as const

describe('isAdminNavItemActive', () => {
  it('activates only temple stats on /admin/temples/stats', () => {
    expect(
      isAdminNavItemActive('/admin/temples/stats', '/admin/temples/stats', navTos),
    ).toBe(true)
    expect(
      isAdminNavItemActive('/admin/temples/stats', '/admin/temples', navTos),
    ).toBe(false)
  })

  it('activates temples list on /admin/temples and nested edit routes', () => {
    expect(isAdminNavItemActive('/admin/temples', '/admin/temples', navTos)).toBe(
      true,
    )
    expect(
      isAdminNavItemActive('/admin/temples/new', '/admin/temples', navTos),
    ).toBe(true)
    expect(
      isAdminNavItemActive('/admin/temples/abc', '/admin/temples', navTos),
    ).toBe(true)
    expect(
      isAdminNavItemActive('/admin/temples/new', '/admin/temples/stats', navTos),
    ).toBe(false)
  })

  it('activates only member stats on /admin/members/stats', () => {
    expect(
      isAdminNavItemActive('/admin/members/stats', '/admin/members/stats', navTos),
    ).toBe(true)
    expect(
      isAdminNavItemActive('/admin/members/stats', '/admin/members/tang', navTos),
    ).toBe(false)
  })
})
