import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearFormLocalDraft,
  readFormLocalDraft,
  serializeDraftFields,
  writeFormLocalDraft,
} from '#/lib/formLocalDraft'

export function useFormLocalDraft<TFields extends Record<string, unknown>>(options: {
  storageKey: string
  enabled: boolean
  /**
   * When true (record already loaded from the server), never hydrate from
   * localStorage — always show server fields. Any stale local draft is cleared.
   * Local drafts are only restored when there is no server record yet (create).
   */
  hasServerData?: boolean
  /** Called once on mount when a draft exists and should be restored */
  onRestore?: (fields: TFields) => void
  debounceMs?: number
}): {
  persist: (fields: TFields) => void
  clear: () => void
  restored: boolean
} {
  const {
    storageKey,
    enabled,
    hasServerData = false,
    onRestore,
    debounceMs = 400,
  } = options
  const [restored, setRestored] = useState(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onRestoreRef = useRef(onRestore)
  onRestoreRef.current = onRestore

  useEffect(() => {
    if (!enabled) {
      setRestored(false)
      return
    }

    if (hasServerData) {
      clearFormLocalDraft(storageKey)
      setRestored(false)
      return
    }

    const draft = readFormLocalDraft<TFields>(storageKey)
    if (!draft) {
      setRestored(false)
      return
    }

    onRestoreRef.current?.(draft.fields)
    setRestored(true)
  }, [enabled, hasServerData, storageKey])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const persist = useCallback(
    (fields: TFields) => {
      if (!enabled || hasServerData) return

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null
        writeFormLocalDraft(storageKey, serializeDraftFields(fields))
      }, debounceMs)
    },
    [debounceMs, enabled, hasServerData, storageKey],
  )

  const clear = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (!enabled) return

    clearFormLocalDraft(storageKey)
  }, [enabled, storageKey])

  return { persist, clear, restored }
}
