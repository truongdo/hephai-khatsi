import { describe, expect, it } from 'vitest'
import { shouldShowAppHeader } from './__root'

describe('root route shell', () => {
  it('shows AppHeader on public non-filler pages', () => {
    expect(shouldShowAppHeader('/')).toBe(true)
    expect(shouldShowAppHeader('/login')).toBe(true)
  })

  it('hides AppHeader on admin and filler pages', () => {
    expect(shouldShowAppHeader('/admin')).toBe(false)
    expect(shouldShowAppHeader('/admin/temples')).toBe(false)
    expect(shouldShowAppHeader('/f/public')).toBe(false)
    expect(shouldShowAppHeader('/f/public/edit/member')).toBe(false)
  })
})
