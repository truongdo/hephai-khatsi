import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (path: string) => (options: Record<string, unknown>) => ({
    options,
    path,
  }),
  Outlet: () => <div data-testid="route-outlet" />,
}))

vi.mock('#/components/filler/FillerEditorShell', () => ({
  FillerEditorShell: () => <div data-testid="editor-shell" />,
}))

afterEach(() => {
  cleanup()
})

describe('filler edit layout routes', () => {
  it('renders an outlet for member child routes', async () => {
    const { Route } = await import('./f.$token.edit.member')
    const Component = Route.options.component as React.ComponentType

    render(<Component />)

    expect(screen.getByTestId('route-outlet')).toBeTruthy()
    expect(screen.queryByTestId('editor-shell')).toBeNull()
  })

  it('renders an outlet for temple child routes', async () => {
    const { Route } = await import('./f.$token.edit.temple')
    const Component = Route.options.component as React.ComponentType

    render(<Component />)

    expect(screen.getByTestId('route-outlet')).toBeTruthy()
    expect(screen.queryByTestId('editor-shell')).toBeNull()
  })
})
