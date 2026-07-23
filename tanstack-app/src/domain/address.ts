export type AddressValue = {
  cityCode: string
  cityName: string
  wardCode: string
  wardName: string
  line?: string
}

export type AddressDraft = {
  cityCode: string
  cityName: string
  wardCode: string
  wardName: string
  line: string
}

export const EMPTY_ADDRESS_DRAFT: AddressDraft = {
  cityCode: '',
  cityName: '',
  wardCode: '',
  wardName: '',
  line: '',
}

export type AddressValidationResult = {
  valid: boolean
  errors: { city?: 'REQUIRED'; ward?: 'REQUIRED' }
}

export function isAddressBlank(draft: AddressDraft): boolean {
  return !draft.cityCode && !draft.wardCode && !draft.line.trim()
}

export function validateAddressDraft(
  draft: AddressDraft,
  options?: { required?: boolean },
): AddressValidationResult {
  if (isAddressBlank(draft)) {
    if (options?.required) {
      return {
        valid: false,
        errors: { city: 'REQUIRED', ward: 'REQUIRED' },
      }
    }
    return { valid: true, errors: {} }
  }
  const errors: AddressValidationResult['errors'] = {}
  if (!draft.cityCode) errors.city = 'REQUIRED'
  if (!draft.wardCode) errors.ward = 'REQUIRED'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function hydrateAddress(
  value: string | AddressValue | undefined,
): AddressDraft {
  if (!value) return { ...EMPTY_ADDRESS_DRAFT }
  if (typeof value === 'string') {
    return { ...EMPTY_ADDRESS_DRAFT, line: value }
  }
  return {
    cityCode: value.cityCode,
    cityName: value.cityName,
    wardCode: value.wardCode,
    wardName: value.wardName,
    line: value.line ?? '',
  }
}

export function addressDraftToValue(
  draft: AddressDraft,
): AddressValue | undefined {
  if (!validateAddressDraft(draft).valid) return undefined
  if (isAddressBlank(draft)) return undefined
  const line = draft.line.trim()
  return {
    cityCode: draft.cityCode,
    cityName: draft.cityName,
    wardCode: draft.wardCode,
    wardName: draft.wardName,
    ...(line ? { line } : {}),
  }
}

export function isStructuredAddress(
  value: string | AddressValue | undefined,
): value is AddressValue {
  return typeof value === 'object' && value !== null
}

export function formatAddressDisplay(
  value: string | AddressValue | undefined,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return [value.line, value.wardName, value.cityName].filter(Boolean).join(', ')
}
