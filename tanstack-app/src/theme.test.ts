import { describe, expect, it } from 'vitest'
import { theme } from './theme'

describe('theme', () => {
  it('exports a Mantine theme object', () => {
    expect(theme).toBeTypeOf('object')
    expect(theme).not.toBeNull()
  })

  it('shows overflow scrollbars on option dropdowns', () => {
    for (const name of ['Select', 'Autocomplete', 'MultiSelect', 'TagsInput'] as const) {
      const component = theme.components?.[name] as
        | { defaultProps?: { scrollAreaProps?: { type?: string } } }
        | undefined
      expect(component?.defaultProps?.scrollAreaProps?.type).toBe('auto')
    }
  })
})
