import { describe, expect, it } from 'vitest'
import { isGmailEmail, normalizeEmail } from './gmail'

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Foo.Bar@Gmail.COM ')).toBe('foo.bar@gmail.com')
  })
})

describe('isGmailEmail', () => {
  it('accepts @gmail.com', () => {
    expect(isGmailEmail('a@gmail.com')).toBe(true)
    expect(isGmailEmail('A@Gmail.Com')).toBe(true)
  })
  it('rejects other domains and empty', () => {
    expect(isGmailEmail('a@googlemail.com')).toBe(false)
    expect(isGmailEmail('a@hephai.org')).toBe(false)
    expect(isGmailEmail('')).toBe(false)
    expect(isGmailEmail(undefined)).toBe(false)
    expect(isGmailEmail('@gmail.com')).toBe(false)
  })
})
