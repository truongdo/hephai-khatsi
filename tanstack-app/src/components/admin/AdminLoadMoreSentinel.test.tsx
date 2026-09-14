import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { theme } from '../../theme'
import { AdminLoadMoreSentinel } from './AdminLoadMoreSentinel'

type ObserverCallback = IntersectionObserverCallback

let observerCallback: ObserverCallback | null = null
let observedElements: Element[] = []

function triggerIntersect(isIntersecting: boolean) {
  if (!observerCallback || observedElements.length === 0) return
  observerCallback(
    observedElements.map(
      (target) =>
        ({
          isIntersecting,
          target,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: 0,
        }) satisfies IntersectionObserverEntry,
    ),
    {} as IntersectionObserver,
  )
}

function renderSentinel(props: {
  hasMore: boolean
  isFetching: boolean
  onLoadMore: () => void
}) {
  return render(
    <MantineProvider theme={theme}>
      <AdminLoadMoreSentinel {...props} />
    </MantineProvider>,
  )
}

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver =
    ResizeObserverMock as unknown as typeof ResizeObserver

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

beforeEach(() => {
  observerCallback = null
  observedElements = []

  class IntersectionObserverMock {
    constructor(cb: ObserverCallback) {
      observerCallback = cb
    }
    observe(el: Element) {
      observedElements.push(el)
    }
    unobserve() {}
    disconnect() {
      observedElements = []
    }
    takeRecords() {
      return []
    }
    root = null
    rootMargin = ''
    thresholds = []
  }

  globalThis.IntersectionObserver =
    IntersectionObserverMock as unknown as typeof IntersectionObserver
})

describe('AdminLoadMoreSentinel', () => {
  it('renders nothing when there is no more data', () => {
    const { container, rerender } = renderSentinel({
      hasMore: false,
      isFetching: false,
      onLoadMore: vi.fn(),
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(container.querySelector('[aria-hidden]')).toBeNull()

    rerender(
      <MantineProvider theme={theme}>
        <AdminLoadMoreSentinel
          hasMore={false}
          isFetching
          onLoadMore={vi.fn()}
        />
      </MantineProvider>,
    )
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a loader while fetching more', () => {
    renderSentinel({
      hasMore: true,
      isFetching: true,
      onLoadMore: vi.fn(),
    })
    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('calls onLoadMore when the sentinel intersects and more data is available', async () => {
    const onLoadMore = vi.fn()
    renderSentinel({
      hasMore: true,
      isFetching: false,
      onLoadMore,
    })

    expect(observedElements.length).toBe(1)
    triggerIntersect(true)

    await waitFor(() => {
      expect(onLoadMore).toHaveBeenCalledTimes(1)
    })
  })

  it('does not call onLoadMore while fetching', () => {
    const onLoadMore = vi.fn()
    renderSentinel({
      hasMore: true,
      isFetching: true,
      onLoadMore,
    })

    expect(observedElements.length).toBe(0)
    triggerIntersect(true)
    expect(onLoadMore).not.toHaveBeenCalled()
  })
})
