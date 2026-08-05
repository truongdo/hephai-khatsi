import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  scheduleScrollToFirstFieldError,
  scrollToFirstFieldError,
} from './scrollToFirstFieldError'

describe('scrollToFirstFieldError', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('scrolls to first aria-invalid element', () => {
    const invalid = document.createElement('input')
    invalid.setAttribute('aria-invalid', 'true')
    const scrollIntoView = vi.fn()
    invalid.scrollIntoView = scrollIntoView
    document.body.append(invalid)

    scrollToFirstFieldError(document)

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    })
  })

  it('falls back to data-field-error when no aria-invalid', () => {
    const marker = document.createElement('p')
    marker.setAttribute('data-field-error', 'true')
    const scrollIntoView = vi.fn()
    marker.scrollIntoView = scrollIntoView
    document.body.append(marker)

    scrollToFirstFieldError(document)

    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('prefers aria-invalid over data-field-error', () => {
    const marker = document.createElement('p')
    marker.setAttribute('data-field-error', 'true')
    marker.scrollIntoView = vi.fn()
    const invalid = document.createElement('input')
    invalid.setAttribute('aria-invalid', 'true')
    const scrollIntoView = vi.fn()
    invalid.scrollIntoView = scrollIntoView
    document.body.append(marker, invalid)

    scrollToFirstFieldError(document)

    expect(scrollIntoView).toHaveBeenCalled()
    expect(marker.scrollIntoView).not.toHaveBeenCalled()
  })

  it('is a no-op when nothing matches', () => {
    expect(() => scrollToFirstFieldError(document)).not.toThrow()
  })

  it('scheduleScrollToFirstFieldError runs after double rAF', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })

    const invalid = document.createElement('input')
    invalid.setAttribute('aria-invalid', 'true')
    const scrollIntoView = vi.fn()
    invalid.scrollIntoView = scrollIntoView
    document.body.append(invalid)

    scheduleScrollToFirstFieldError(document)
    expect(scrollIntoView).not.toHaveBeenCalled()

    frames[0]?.(0)
    expect(scrollIntoView).not.toHaveBeenCalled()

    frames[1]?.(0)
    expect(scrollIntoView).toHaveBeenCalled()
  })
})
