import { describe, expect, it } from 'vitest'
import { theme } from './theme'

describe('theme', () => {
  it('exports a Mantine theme object', () => {
    expect(theme).toBeTypeOf('object')
    expect(theme).not.toBeNull()
  })
})
