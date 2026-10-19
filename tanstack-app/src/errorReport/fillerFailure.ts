import * as Sentry from '@sentry/react'
import type { AdminRole } from '#/domain/authClaims'
import {
  classifySaveFailure,
  newReferenceCode,
  type SaveFailureReason,
} from '#/domain/saveFailure'
import { m } from '#/paraglide/messages'
import { getCurrentUserClaims } from '#/repositories/authRepo'

export type FillerFailureStage = 'save' | 'photo' | 'documents'

export type FillerFailureInput = {
  error: unknown
  form: 'temple' | 'member'
  stage: FillerFailureStage
  orgUnitId: string
  sanghaType?: string
  /** Only for ids that carry no personal data (member ids embed the CCCD). */
  recordId?: string
}

export type ClientErrorReport = {
  ref: string
  form: string
  stage: string
  reason: SaveFailureReason
  code: string
  message: string
  orgUnitId: string
  sanghaType?: string
  recordId?: string
  signedInRole?: AdminRole
  online: boolean
  path: string
  userAgent: string
  at: string
}

function saveReasonMessage(reason: SaveFailureReason): string {
  switch (reason) {
    case 'signed_in_staff':
      return m.filler_error_signed_in_staff()
    case 'record_locked':
      return m.filler_error_record_locked()
    case 'permission_denied':
      return m.filler_error_permission_denied()
    case 'network':
      return m.filler_error_network()
    case 'invite_invalid':
      return m.filler_error_invite_invalid()
    case 'invalid_input':
      return m.filler_error_invalid_input()
    case 'not_found':
      return m.filler_error_not_found()
    case 'unknown':
      return m.filler_save_error()
  }
}

function stageMessage(
  stage: FillerFailureStage,
  reason: SaveFailureReason,
): string {
  // Upload stages run after the record is saved; keep their own wording
  // unless the cause is something the visitor can fix right away.
  if (stage === 'save' || reason === 'network' || reason === 'signed_in_staff') {
    return saveReasonMessage(reason)
  }
  return stage === 'photo'
    ? m.filler_photo_upload_error()
    : m.filler_doc_upload_error()
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : ''
}

export function sendClientErrorReport(report: ClientErrorReport): void {
  try {
    void fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {
      // reporting must never surface a second error
    })
  } catch {
    // fetch unavailable
  }
}

/**
 * Classifies a public-form failure, reports it to the Worker (Workers Logs),
 * and returns the message to show, ending with a reference code the visitor
 * can read out to an admin.
 */
export async function describeFillerFailure(
  input: FillerFailureInput,
): Promise<string> {
  let signedInRole: AdminRole | null = null
  try {
    signedInRole = (await getCurrentUserClaims())?.role ?? null
  } catch {
    // treat as signed out
  }
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  const { reason, code } = classifySaveFailure(input.error, {
    signedInRole,
    online,
  })
  const ref = newReferenceCode()

  console.error(`[filler] ${input.form} ${input.stage} failed (${ref})`, input.error)
  Sentry.captureException(input.error, {
    // Known, visitor-fixable causes are warnings; 'unknown' is a real bug.
    level: reason === 'unknown' ? 'error' : 'warning',
    tags: {
      ref,
      form: input.form,
      stage: input.stage,
      reason,
      code,
      orgUnitId: input.orgUnitId,
      signedInRole: signedInRole ?? 'none',
    },
  })
  sendClientErrorReport({
    ref,
    form: input.form,
    stage: input.stage,
    reason,
    code,
    message: errorMessageOf(input.error),
    orgUnitId: input.orgUnitId,
    sanghaType: input.sanghaType,
    recordId: input.recordId,
    signedInRole: signedInRole ?? undefined,
    online,
    // pathname only: the query string can carry the visitor's phone number
    path: typeof location === 'undefined' ? '' : location.pathname,
    userAgent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    at: new Date().toISOString(),
  })

  return `${stageMessage(input.stage, reason)} ${m.filler_error_reference({ code: ref })}`
}
