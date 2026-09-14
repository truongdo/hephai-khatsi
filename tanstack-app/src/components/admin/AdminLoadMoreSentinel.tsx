import { Center, Loader } from '@mantine/core'
import { useEffect, useRef } from 'react'

export type AdminLoadMoreSentinelProps = {
  hasMore: boolean
  isFetching: boolean
  onLoadMore: () => void
}

export function AdminLoadMoreSentinel({
  hasMore,
  isFetching,
  onLoadMore,
}: AdminLoadMoreSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  useEffect(() => {
    if (!hasMore || isFetching) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        onLoadMoreRef.current()
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isFetching])

  if (!hasMore) return null

  if (isFetching) {
    return (
      <Center py="md" role="status">
        <Loader size="sm" />
      </Center>
    )
  }

  return <div ref={sentinelRef} aria-hidden style={{ height: 1 }} />
}
