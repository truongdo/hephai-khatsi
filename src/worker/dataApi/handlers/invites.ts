import { directoryOrgOk } from '#/domain/authz/caller'
import { canCreateInvite } from '#/domain/authz/invites'
import { DomainError } from '#/domain/errors'
import { PUBLIC_INVITE_ID, retreatRegistrationInviteId } from '#/domain/invite'
import type { Invite } from '#/domain/types'
import type { DataContext } from '../context'
import { enumField, stringField, type Body } from '../input'
import { authorize } from '../records'
import { route, type DataRoute } from '../route'
import { inviteFromRow, inviteToRow, type InviteRow } from '../rows/invite'
import { retreatFromRow, type RetreatRow } from '../rows/retreat'
import { conflictGuard, insertNewStatement, runBatch, selectFirst } from '../sql'

// Ports of src/repositories/inviteRepo.ts. Invites are created once and never
// changed; the server builds them from the kind (and retreat).

type CreateInput = { kind: 'filler' } | { kind: 'retreat_registration'; retreatId: string }

async function getByToken(ctx: DataContext, input: { token: string }): Promise<Invite | null> {
  const row = await selectFirst<InviteRow>(ctx.db, 'SELECT * FROM invites WHERE id = ?', [input.token])
  return row ? inviteFromRow(row) : null
}

async function buildInvite(ctx: DataContext, input: CreateInput): Promise<Invite> {
  const base = { createdBy: ctx.caller?.uid ?? '', createdAt: ctx.now, disabled: false }
  if (input.kind === 'filler') {
    return { ...base, id: PUBLIC_INVITE_ID, token: PUBLIC_INVITE_ID, kind: 'filler', retreatId: null, orgUnitId: null }
  }
  const row = await selectFirst<RetreatRow>(ctx.db, 'SELECT * FROM retreats WHERE id = ?', [input.retreatId])
  if (!row) throw new DomainError('NOT_FOUND', 'Retreat not found')
  const retreat = retreatFromRow(row)
  // ensureRetreatRegistrationInvite's org check, on the server too.
  authorize(directoryOrgOk(ctx.caller, retreat.orgUnitId))
  const id = retreatRegistrationInviteId(retreat.id)
  return {
    ...base,
    id,
    token: id,
    kind: 'retreat_registration',
    retreatId: retreat.id,
    orgUnitId: retreat.orgUnitId,
  }
}

async function create(ctx: DataContext, input: CreateInput): Promise<Invite> {
  const invite = await buildInvite(ctx, input)
  authorize(canCreateInvite(ctx.caller, invite))
  if (await getByToken(ctx, { token: invite.id })) {
    throw new DomainError('ALREADY_EXISTS', 'Invite already exists')
  }
  await runBatch(ctx.db, [insertNewStatement(ctx.db, 'invites', inviteToRow(invite)), conflictGuard(ctx.db)])
  return invite
}

function parseCreate(body: Body): CreateInput {
  const kind = enumField(body, 'kind', ['filler', 'retreat_registration'] as const)
  return kind === 'filler' ? { kind } : { kind, retreatId: stringField(body, 'retreatId') }
}

export const inviteRoutes: Record<string, DataRoute> = {
  'invites/get': route((body) => ({ token: stringField(body, 'token') }), getByToken),
  'invites/create': route(parseCreate, create),
}
