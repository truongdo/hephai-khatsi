import type { Env } from './env'
import { recordSource } from './recordSource'

/**
 * A filler may upload or delete a record's photo / documents only when the
 * data API will then accept the record change: the invite they hold exists
 * and so does the record's own invite (an admin-made draft has none until
 * the filler's save-and-lock adopts one). Checked before touching R2, which
 * the data API cannot undo.
 */
export async function fillerInviteOk(
  env: Pick<Env, 'DB'>,
  recordInviteId: string | null,
  inviteToken: string,
): Promise<boolean> {
  if (recordInviteId === null) return false
  const source = recordSource(env)
  const ids = [...new Set([inviteToken, recordInviteId])]
  const found = await Promise.all(ids.map((id) => source.inviteExists(id)))
  return found.every(Boolean)
}
