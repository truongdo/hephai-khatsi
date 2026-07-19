import { describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { buildAdminBreadcrumbs } from './adminBreadcrumbs'

describe('buildAdminBreadcrumbs', () => {
  it('builds temples list trail', () => {
    expect(buildAdminBreadcrumbs('/admin/temples')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_temples() },
    ])
  })

  it('builds temple create trail', () => {
    expect(buildAdminBreadcrumbs('/admin/temples/new')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_temples(), href: '/admin/temples' },
      { title: m.admin_temples_form_title_create() },
    ])
  })

  it('builds temple detail trail', () => {
    expect(buildAdminBreadcrumbs('/admin/temples/abc123')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_temples(), href: '/admin/temples' },
      { title: m.admin_temples_form_title_edit() },
    ])
  })

  it('builds members tang trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/tang')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_tang() },
    ])
  })

  it('builds members ni trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/ni')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_ni() },
    ])
  })

  it('builds member create trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/new')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_members_form_title_create() },
    ])
  })

  it('builds member detail trail', () => {
    expect(buildAdminBreadcrumbs('/admin/members/xyz')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_members_form_title_edit() },
    ])
  })

  it('builds org-units trail', () => {
    expect(buildAdminBreadcrumbs('/admin/org-units')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: m.admin_nav_org_units() },
    ])
  })

  it('falls back for unknown segment', () => {
    expect(buildAdminBreadcrumbs('/admin/unknown-thing')).toEqual([
      { title: m.admin_title(), href: '/admin' },
      { title: 'unknown-thing' },
    ])
  })
})
