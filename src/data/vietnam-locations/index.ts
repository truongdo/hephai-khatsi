import citiesJson from './cities.json'
import type { City, Ward } from './types'

export type { City, Ward }

export const cities = citiesJson as City[]

const wardLoaders = import.meta.glob<Ward[]>('./wards/*.json', {
  import: 'default',
})

const wardCache = new Map<string, Ward[]>()

export async function getWards(cityCode: string): Promise<Ward[]> {
  if (wardCache.has(cityCode)) {
    return wardCache.get(cityCode)!
  }
  const loader = wardLoaders[`./wards/${cityCode}.json`]
  if (!loader) return []
  const wards = await loader()
  wardCache.set(cityCode, wards)
  return wards
}
