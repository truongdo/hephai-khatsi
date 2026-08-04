export const FORM_LOCAL_DRAFT_VERSION = 1

export type FormLocalDraftEnvelope<TFields> = {
  version: number
  updatedAt: string
  fields: TFields
}

export function memberDraftStorageKey(
  args:
    | { kind: 'new'; orgUnitId: string; sanghaType: string; actorId: string }
    | { kind: 'existing'; memberId: string },
): string {
  if (args.kind === 'new') {
    return `formDraft:member:new:${args.orgUnitId}:${args.sanghaType}:${args.actorId}`
  }
  return `formDraft:member:${args.memberId}`
}

export function templeDraftStorageKey(
  args:
    | { kind: 'new'; orgUnitId: string; actorId: string }
    | { kind: 'existing'; templeId: string },
): string {
  if (args.kind === 'new') {
    return `formDraft:temple:new:${args.orgUnitId}:${args.actorId}`
  }
  return `formDraft:temple:${args.templeId}`
}

export function serializeDraftFields<T extends Record<string, unknown>>(
  fields: T,
): T {
  const result = {} as T
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (value instanceof File || value instanceof Blob) continue
    result[key as keyof T] = value as T[keyof T]
  }
  return result
}

export function readFormLocalDraft<T>(
  key: string,
): FormLocalDraftEnvelope<T> | null {
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as FormLocalDraftEnvelope<T>
  } catch {
    return null
  }
}

export function writeFormLocalDraft<T extends Record<string, unknown>>(
  key: string,
  fields: T,
  now?: string,
): void {
  const envelope: FormLocalDraftEnvelope<T> = {
    version: FORM_LOCAL_DRAFT_VERSION,
    updatedAt: now ?? new Date().toISOString(),
    fields: serializeDraftFields(fields),
  }
  try {
    localStorage.setItem(key, JSON.stringify(envelope))
  } catch {
    // QuotaExceededError or other storage failures — silently ignore
  }
}

export function clearFormLocalDraft(key: string): void {
  localStorage.removeItem(key)
}
