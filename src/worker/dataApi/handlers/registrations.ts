import { canCreateRegistration, canReviewRegistration } from '#/domain/authz/registrations'
import { DomainError } from '#/domain/errors'
import type { RegisteredVia, RetreatRegistration } from '#/domain/retreatRegistration'
import {
  assertMemberOrgMatches,
  assertQuyenAllows,
  assertRegistrationOpen,
  normalizeRejectionReason,
  retreatRegistrationId,
  validateExtraAnswers,
} from '#/domain/retreatRegistration'
import type { DataContext } from '../context'
import {
  enumField,
  objectField,
  optionalIntField,
  optionalStringField,
  stringArrayField,
  stringField,
  type Body,
} from '../input'
import { eq, listPage } from '../listPage'
import { authorize, type Versioned } from '../records'
import { route, type DataRoute } from '../route'
import { memberFromRow, type MemberRow } from '../rows/member'
import {
  registrationFromRow,
  registrationToRow,
  type RegistrationRow,
} from '../rows/registration'
import { retreatFromRow, type RetreatRow } from '../rows/retreat'
import {
  conflictGuard,
  insertNewStatement,
  runBatch,
  selectByIds,
  selectFirst,
  updateVersionedRowsStatements,
} from '../sql'
import { directoryListScope } from './shared'

// Ports of src/repositories/retreatRegistrationRepo.ts. Creating runs the
// checks of the createRetreatRegistration use case on the server too (the
// rules left the retreat's state and org unit to the client).

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 500
const MAX_IDS = 500
const MAX_EXTRA_ANSWERS = 50

async function readRegistration(db: D1Database, id: string): Promise<RetreatRegistration | null> {
  const row = await selectFirst<RegistrationRow>(db, 'SELECT * FROM retreat_registrations WHERE id = ?', [id])
  return row ? registrationFromRow(row) : null
}

type CreateInput = {
  retreatId: string
  memberId: string
  registeredVia: RegisteredVia
  extraAnswers: Record<string, string>
}

async function create(ctx: DataContext, input: CreateInput): Promise<RetreatRegistration> {
  const { db, caller } = ctx
  const retreatRow = await selectFirst<RetreatRow>(db, 'SELECT * FROM retreats WHERE id = ?', [input.retreatId])
  if (!retreatRow) throw new DomainError('NOT_FOUND', 'Retreat not found')
  const retreat = retreatFromRow(retreatRow)
  assertRegistrationOpen(retreat, ctx.now)
  assertQuyenAllows(retreat.quyenDangKy, input.registeredVia)
  if (input.registeredVia === 'proxy' && !caller) {
    throw new DomainError('UNAUTHORIZED', 'Proxy registration requires authentication')
  }

  const memberRow = await selectFirst<MemberRow>(db, 'SELECT * FROM members WHERE id = ?', [input.memberId])
  if (!memberRow) throw new DomainError('NOT_FOUND', 'Member not found')
  assertMemberOrgMatches(memberFromRow(memberRow).orgUnitId, retreat.orgUnitId)
  validateExtraAnswers(retreat.extraFields, input.extraAnswers)

  const id = retreatRegistrationId(input.retreatId, input.memberId)
  if (await readRegistration(db, id)) {
    throw new DomainError('ALREADY_EXISTS', 'Registration already exists')
  }
  const registration: RetreatRegistration = {
    id,
    retreatId: input.retreatId,
    memberId: input.memberId,
    orgUnitId: retreat.orgUnitId,
    registeredVia: input.registeredVia,
    registeredBy: input.registeredVia === 'proxy' ? (caller?.uid ?? null) : null,
    extraAnswers: input.extraAnswers,
    status: 'pending',
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
  authorize(canCreateRegistration(caller, registration))
  await runBatch(db, [
    insertNewStatement(db, 'retreat_registrations', registrationToRow(registration)),
    conflictGuard(db),
  ])
  return registration
}

type ReviewInput = {
  ids: string[]
  status: 'approved' | 'rejected'
  rejectionReason: string | null
}

/** Approves or rejects pending registrations; the reviewer is the caller. */
async function review(ctx: DataContext, input: ReviewInput): Promise<RetreatRegistration[]> {
  const { db, caller } = ctx
  const rows = await selectByIds<Versioned<RegistrationRow>>(db, 'retreat_registrations', input.ids)
  if (rows.length !== new Set(input.ids).size) {
    throw new DomainError('NOT_FOUND', 'Registration not found')
  }
  const review = {
    status: input.status,
    approvedBy: caller?.uid ?? null,
    approvedAt: ctx.now,
    rejectionReason: input.status === 'rejected' ? input.rejectionReason : null,
    updatedAt: ctx.now,
  }
  const reviewed = rows.map((row) => {
    const before = registrationFromRow(row)
    const after: RetreatRegistration = { ...before, ...review }
    authorize(canReviewRegistration(caller, before, after))
    return after
  })
  // Review fields are all columns, so one UPDATE per chunk sets them.
  await runBatch(
    db,
    updateVersionedRowsStatements(
      db,
      'retreat_registrations',
      {
        status: review.status,
        approved_by: review.approvedBy,
        approved_at: review.approvedAt,
        rejection_reason: review.rejectionReason,
        updated_at: review.updatedAt,
      },
      rows,
    ),
  )
  return reviewed
}

async function getById(ctx: DataContext, input: { id: string }): Promise<RetreatRegistration | null> {
  return readRegistration(ctx.db, input.id)
}

/** A giáo đoàn admin sees the registrations of their own org unit only. */
async function listByRetreat(
  ctx: DataContext,
  input: { retreatId: string; limit: number; cursor?: string },
) {
  const scope = directoryListScope(ctx.caller)
  const page = await listPage<RegistrationRow>(ctx.db, {
    table: 'retreat_registrations',
    filters: [eq('retreat_id', input.retreatId), eq('org_unit_id', scope.orgUnitId ?? undefined)],
    sortColumn: 'created_at',
    sortDir: 'desc',
    limit: input.limit,
    cursor: input.cursor,
  })
  return { items: page.items.map(registrationFromRow), nextCursor: page.nextCursor }
}

// --- routes ---

function parseExtraAnswers(body: Body): Record<string, string> {
  const answers = objectField(body, 'extraAnswers')
  const entries = Object.entries(answers)
  if (entries.length > MAX_EXTRA_ANSWERS || !entries.every(([, value]) => typeof value === 'string')) {
    throw new DomainError('INVALID_INPUT', 'extraAnswers must map field keys to strings')
  }
  return answers as Record<string, string>
}

/** Free text, possibly blank (blank means no reason). */
function parseRejectionReason(body: Body): string | null {
  const reason = body.rejectionReason
  if (reason != null && typeof reason !== 'string') {
    throw new DomainError('INVALID_INPUT', 'rejectionReason must be a string')
  }
  return normalizeRejectionReason(reason)
}

export const registrationRoutes: Record<string, DataRoute> = {
  'registrations/get': route((body) => ({ id: stringField(body, 'id') }), getById),
  'registrations/list-by-retreat': route(
    (body) => ({
      retreatId: stringField(body, 'retreatId'),
      limit: optionalIntField(body, 'limit', { min: 1, max: MAX_PAGE_SIZE }) ?? DEFAULT_PAGE_SIZE,
      cursor: optionalStringField(body, 'cursor'),
    }),
    listByRetreat,
  ),
  'registrations/create': route(
    (body) => ({
      retreatId: stringField(body, 'retreatId'),
      memberId: stringField(body, 'memberId'),
      registeredVia: enumField(body, 'registeredVia', ['self', 'proxy'] as const),
      extraAnswers: parseExtraAnswers(body),
    }),
    create,
  ),
  'registrations/review': route(
    (body) => ({
      ids: stringArrayField(body, 'ids', MAX_IDS),
      status: enumField(body, 'status', ['approved', 'rejected'] as const),
      rejectionReason: parseRejectionReason(body),
    }),
    review,
  ),
}
