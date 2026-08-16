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
  errors: { city?: 'REQUIRED'; ward?: 'REQUIRED'; line?: 'REQUIRED' }
}

export function isAddressBlank(draft: AddressDraft): boolean {
  return (
    !draft.cityCode &&
    !draft.cityName.trim() &&
    !draft.wardCode &&
    !draft.line.trim()
  )
}

export function validateAddressDraft(
  draft: AddressDraft,
  options?: {
    required?: boolean
    cityOnly?: boolean
    lineRequired?: boolean
  },
): AddressValidationResult {
  const cityOnly = options?.cityOnly === true
  const lineRequired = options?.lineRequired === true

  if (isAddressBlank(draft)) {
    if (options?.required) {
      const errors: AddressValidationResult['errors'] = cityOnly
        ? { city: 'REQUIRED' }
        : { city: 'REQUIRED', ward: 'REQUIRED' }
      if (lineRequired && !cityOnly) errors.line = 'REQUIRED'
      return { valid: false, errors }
    }
    return { valid: true, errors: {} }
  }
  const errors: AddressValidationResult['errors'] = {}
  if (cityOnly) {
    if (!draft.cityCode && !draft.cityName.trim()) errors.city = 'REQUIRED'
  } else if (!draft.cityCode) {
    errors.city = 'REQUIRED'
  }
  if (!cityOnly && !draft.wardCode) errors.ward = 'REQUIRED'
  if (!cityOnly && lineRequired && !draft.line.trim()) errors.line = 'REQUIRED'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function hydrateAddress(
  value: string | AddressValue | undefined,
  options?: { cityOnly?: boolean },
): AddressDraft {
  if (!value) return { ...EMPTY_ADDRESS_DRAFT }
  if (typeof value === 'string') {
    if (options?.cityOnly) {
      return { ...EMPTY_ADDRESS_DRAFT, cityName: value }
    }
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
  options?: { cityOnly?: boolean },
): AddressValue | undefined {
  if (options?.cityOnly) {
    const cityName = draft.cityName.trim()
    if (!draft.cityCode && !cityName) return undefined
    return {
      cityCode: draft.cityCode,
      cityName: cityName || draft.cityName,
      wardCode: '',
      wardName: '',
    }
  }
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
