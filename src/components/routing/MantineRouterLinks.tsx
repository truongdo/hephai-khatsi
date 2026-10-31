import { Button, Text } from '@mantine/core'
import type { ButtonProps, TextProps } from '@mantine/core'
import { createLink } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, Ref } from 'react'

type AnchorRef = { ref?: Ref<HTMLAnchorElement> }

// `component={Link}` on a Mantine component loses the router's route typing
// (params/search fall back to reducer functions); createLink keeps it.
export const ButtonLink = createLink(
  (props: ButtonProps & AnchorHTMLAttributes<HTMLAnchorElement> & AnchorRef) => (
    <Button component="a" {...props} />
  ),
)

export const TextLink = createLink(
  (props: TextProps & AnchorHTMLAttributes<HTMLAnchorElement> & AnchorRef) => (
    <Text component="a" {...props} />
  ),
)
