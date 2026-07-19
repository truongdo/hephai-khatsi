import { m } from '#/paraglide/messages'

export type AdminBreadcrumb = {
  title: string
  href?: string
}

function rootCrumb(): AdminBreadcrumb {
  return { title: m.admin_title(), href: '/admin' }
}

export function buildAdminBreadcrumbs(pathname: string): AdminBreadcrumb[] {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  const parts = normalized.split('/').filter(Boolean)
  // parts[0] === 'admin'

  if (parts.length <= 1) {
    return [{ title: m.admin_title() }]
  }

  const section = parts[1]
  const rest = parts.slice(2)

  if (section === 'org-units') {
    return [rootCrumb(), { title: m.admin_nav_org_units() }]
  }

  if (section === 'temples') {
    if (rest.length === 0) {
      return [rootCrumb(), { title: m.admin_nav_temples() }]
    }
    const leaf =
      rest[0] === 'new'
        ? m.admin_temples_form_title_create()
        : m.admin_temples_form_title_edit()
    return [
      rootCrumb(),
      { title: m.admin_nav_temples(), href: '/admin/temples' },
      { title: leaf },
    ]
  }

  if (section === 'members') {
    if (rest[0] === 'tang') {
      return [rootCrumb(), { title: m.admin_nav_tang() }]
    }
    if (rest[0] === 'ni') {
      return [rootCrumb(), { title: m.admin_nav_ni() }]
    }
    if (rest[0] === 'new') {
      return [rootCrumb(), { title: m.admin_members_form_title_create() }]
    }
    if (rest[0]) {
      return [rootCrumb(), { title: m.admin_members_form_title_edit() }]
    }
  }

  return [rootCrumb(), { title: section }]
}
