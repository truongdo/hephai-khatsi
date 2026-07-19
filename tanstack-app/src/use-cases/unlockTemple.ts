import type { Temple } from '#/domain/types'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type UnlockTempleInput = { templeId: string }

export async function unlockTemple(
  input: UnlockTempleInput,
  templeStore: TempleStore = templeRepo,
): Promise<Temple> {
  return templeStore.unlock(input.templeId)
}
