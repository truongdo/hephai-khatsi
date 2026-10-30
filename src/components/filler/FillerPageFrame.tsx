import { Container, Paper, Stack } from '@mantine/core'
import type { ReactNode } from 'react'

type FillerPageFrameProps = {
  children: ReactNode
}

export function FillerPageFrame({ children }: FillerPageFrameProps) {
  return (
    <Container size={760} py="xl" px={{ base: 'md', sm: 'lg' }}>
      <Paper p="xl" radius="md">
        <Stack gap="lg">{children}</Stack>
      </Paper>
    </Container>
  )
}
