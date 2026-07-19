import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { m } from '#/paraglide/messages'
import { theme } from '../../theme'
import { FillerEditorShell } from './FillerEditorShell'

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

function renderShell(
  props: Partial<React.ComponentProps<typeof FillerEditorShell>> = {},
) {
  return render(
    <MantineProvider theme={theme} defaultColorScheme="light">
      <FillerEditorShell
        title={m.filler_editor_title_member_new()}
        status="draft"
        {...props}
      />
    </MantineProvider>,
  )
}

describe('FillerEditorShell', () => {
  it('renders sticky title and draft status badge', () => {
    renderShell({ status: 'draft' })

    expect(
      screen.getByRole('heading', { name: m.filler_editor_title_member_new() }),
    ).toBeTruthy()
    expect(screen.getByText(m.filler_status_draft())).toBeTruthy()

    const header = screen.getByTestId('filler-editor-header')
    expect(header.style.position).toBe('sticky')
  })

  it('renders view status badge when locked', () => {
    renderShell({ status: 'view' })

    expect(screen.getByText(m.filler_status_view())).toBeTruthy()
    expect(screen.queryByText(m.filler_status_draft())).toBeNull()
  })

  it('shows default placeholder body when no children', () => {
    renderShell()

    expect(screen.getByText(m.filler_editor_placeholder())).toBeTruthy()
  })

  it('renders custom children instead of default placeholder', () => {
    renderShell({ children: <p>Custom editor body</p> })

    expect(screen.getByText('Custom editor body')).toBeTruthy()
    expect(screen.queryByText(m.filler_editor_placeholder())).toBeNull()
  })

  it('does not render a Save button', () => {
    renderShell()

    expect(screen.queryByRole('button', { name: 'Lưu' })).toBeNull()
  })
})
