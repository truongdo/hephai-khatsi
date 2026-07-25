import { useCallback, useEffect, useMemo, useState } from 'react'

export function useAdminListSelection(itemIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const itemIdsKey = itemIds.join(',')

  useEffect(() => {
    setSelectedIds(new Set())
  }, [itemIdsKey])

  const selectedCount = useMemo(() => {
    let count = 0
    for (const id of itemIds) {
      if (selectedIds.has(id)) count += 1
    }
    return count
  }, [itemIds, selectedIds])

  const allLoadedSelected =
    itemIds.length > 0 && selectedCount === itemIds.length
  const someSelected = selectedCount > 0 && !allLoadedSelected

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAllLoaded = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        itemIds.length > 0 && itemIds.every((id) => prev.has(id))
      if (allSelected) {
        const next = new Set(prev)
        for (const id of itemIds) {
          next.delete(id)
        }
        return next
      }
      return new Set([...prev, ...itemIds])
    })
  }, [itemIds])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return {
    selectedIds,
    selectedCount,
    allLoadedSelected,
    someSelected,
    toggle,
    toggleAllLoaded,
    clear,
  }
}
