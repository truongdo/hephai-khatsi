import { DomainError } from './errors'
import { normalizeVnPhone } from './normalize'

function addNormalizedPhone(set: Set<string>, raw: string) {
  if (raw.trim()) set.add(normalizeVnPhone(raw))
}

export function collectManagerPhones(input: {
  explicitPhones: string[]
  truTriPhone?: string
}): string[] {
  const set = new Set<string>()
  for (const p of input.explicitPhones) {
    addNormalizedPhone(set, p)
  }
  if (input.truTriPhone?.trim()) {
    addNormalizedPhone(set, input.truTriPhone)
  }
  return [...set]
}

export function buildManagerPhones(input: {
  explicitPhones: string[]
  truTriPhone?: string
}): string[] {
  const phones = collectManagerPhones(input)
  if (phones.length === 0) {
    throw new DomainError(
      'PHONE_REQUIRED',
      'At least one manager phone is required',
    )
  }
  return phones
}

export function mergeManagerPhones(
  existingPhones: string[],
  incoming: { explicitPhones: string[]; truTriPhone?: string },
): string[] {
  const set = new Set(existingPhones)
  for (const phone of collectManagerPhones(incoming)) {
    set.add(phone)
  }
  const phones = [...set]
  if (phones.length === 0) {
    throw new DomainError(
      'PHONE_REQUIRED',
      'At least one manager phone is required',
    )
  }
  return phones
}
