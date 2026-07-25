import { Box, Group, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

export type FormStickyActionsProps = {
  children: ReactNode
  /** Optional status / error line above the buttons */
  status?: ReactNode
}

/**
 * Viewport-fixed bottom action strip for long forms.
 * Renders a spacer so the last form fields stay scrollable above the bar.
 */
export function FormStickyActions({ children, status }: FormStickyActionsProps) {
  return (
    <>
      <Box
        aria-hidden
        data-testid="form-sticky-actions-spacer"
        style={{
          height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
          flexShrink: 0,
        }}
      />
      <Box
        component="footer"
        data-testid="form-sticky-actions"
        style={{
          position: 'fixed',
          left: 'var(--app-shell-navbar-offset, 0px)',
          right: 0,
          bottom: 0,
          zIndex: 100,
          backgroundColor: 'var(--paper, var(--mantine-color-body))',
          borderTop: '1px solid var(--line, var(--mantine-color-gray-3))',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.06)',
          paddingTop: 'var(--mantine-spacing-sm)',
          paddingInline: 'var(--mantine-spacing-md)',
          paddingBottom:
            'calc(var(--mantine-spacing-sm) + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Stack gap="xs" maw={760} w="100%" mx="auto">
          {status}
          <Group gap="sm" wrap="wrap">
            {children}
          </Group>
        </Stack>
      </Box>
    </>
  )
}
