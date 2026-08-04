import type { Temple } from '#/domain/types'
import { templeRepo, type TempleStore } from '#/repositories/templeRepo'

export type RequestTempleEditInput = {
  templeId: string
  phone: string
}

export async function requestTempleEdit(
  input: RequestTempleEditInput,
  templeStore: TempleStore = templeRepo,
): Promise<Temple> {
  return templeStore.requestEdit(input.templeId, input.phone)
}
