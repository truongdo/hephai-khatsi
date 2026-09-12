/** Prefer the longest matching nav path so `/admin/temples/stats` does not also activate `/admin/temples`. */
export function isAdminNavItemActive(
  pathname: string,
  itemTo: string,
  navTos: readonly string[],
): boolean {
  const matches = navTos.filter(
    (to) => pathname === to || pathname.startsWith(`${to}/`),
  )
  if (matches.length === 0) return false
  const best = matches.reduce((a, b) => (a.length >= b.length ? a : b))
  return best === itemTo
}
