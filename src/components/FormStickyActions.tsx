import { Box, CloseButton, Group, Stack } from '@mantine/core'
import {
  Children,
  Fragment,
  isValidElement,
  useState,
  type ReactNode,
} from 'react'
import { m } from '#/paraglide/messages'

export type FormStickyActionsProps = {
  children: ReactNode
  /** Optional status / error line above the buttons */
  status?: ReactNode
}

function flattenStatus(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) => {
    if (isValidElement(child) && child.type === Fragment) {
      return flattenStatus(
        (child.props as { children?: ReactNode }).children,
      )
    }
    return [child]
  })
}

function statusSignature(node: ReactNode | undefined): string {
  if (node == null || node === false) return ''
  return flattenStatus(node)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child)
      }
      if (isValidElement(child)) {
        return statusSignature(
          (child.props as { children?: ReactNode }).children,
        )
      }
      return ''
    })
    .filter(Boolean)
    .join('|')
}

/**
 * Viewport-fixed bottom action strip for long forms.
 * Renders a spacer so the last form fields stay scrollable above the bar.
 */
export function FormStickyActions({ children, status }: FormStickyActionsProps) {
  const signature = statusSignature(status)
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null,
  )

  if (signature === '' && dismissedSignature !== null) {
    setDismissedSignature(null)
  }

  const showStatus = signature !== '' && signature !== dismissedSignature

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
          {showStatus ? (
            <Group
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
              gap="xs"
              data-testid="form-sticky-actions-status"
            >
              <Box style={{ flex: 1, minWidth: 0 }}>{status}</Box>
              <CloseButton
                size="sm"
                aria-label={m.form_status_dismiss()}
                onClick={() => setDismissedSignature(signature)}
              />
            </Group>
          ) : null}
          <Group gap="sm" wrap="wrap">
            {children}
          </Group>
        </Stack>
      </Box>
    </>
  )
}
