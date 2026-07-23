import { Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cities, getWards } from '#/data/vietnam-locations'
import type { Ward } from '#/data/vietnam-locations'
import type { AddressDraft } from '#/domain/address'
import { m } from '#/paraglide/messages'

export type VietnamAddressFieldsProps = {
  label?: string
  value: AddressDraft
  onChange: (value: AddressDraft) => void
  disabled?: boolean
  errors?: { city?: string; ward?: string }
  linePlaceholder?: string
  required?: boolean
}

type LocationFields = Omit<AddressDraft, 'line'>

type LocationSelectsProps = {
  cityCode: string
  wardCode: string
  disabled: boolean
  errors?: { city?: string; ward?: string }
  required?: boolean
  onLocationChange: (location: LocationFields) => void
}

const LocationSelects = memo(function LocationSelects({
  cityCode,
  wardCode,
  disabled,
  errors,
  required,
  onLocationChange,
}: LocationSelectsProps) {
  const [wards, setWards] = useState<Ward[]>([])
  const [wardsLoading, setWardsLoading] = useState(false)

  const cityOptions = useMemo(
    () =>
      cities.map((city) => ({
        value: city.code,
        label: city.fullName,
      })),
    [],
  )

  const wardOptions = useMemo(
    () =>
      wards.map((ward) => ({
        value: ward.code,
        label: ward.fullName,
      })),
    [wards],
  )

  useEffect(() => {
    if (!cityCode) {
      setWards([])
      return
    }
    let cancelled = false
    setWardsLoading(true)
    getWards(cityCode)
      .then((loaded) => {
        if (!cancelled) setWards(loaded)
      })
      .finally(() => {
        if (!cancelled) setWardsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cityCode])

  const handleCityChange = (nextCityCode: string | null) => {
    const city = cities.find((item) => item.code === nextCityCode)
    onLocationChange({
      cityCode: nextCityCode ?? '',
      cityName: city?.name ?? '',
      wardCode: '',
      wardName: '',
    })
  }

  const handleWardChange = (nextWardCode: string | null) => {
    const ward = wards.find((item) => item.code === nextWardCode)
    const city = cities.find((item) => item.code === cityCode)
    onLocationChange({
      cityCode,
      cityName: city?.name ?? '',
      wardCode: nextWardCode ?? '',
      wardName: ward?.name ?? '',
    })
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <Select
        label={m.filler_field_city()}
        placeholder={m.filler_ph_city()}
        data={cityOptions}
        value={cityCode || null}
        onChange={handleCityChange}
        searchable
        disabled={disabled}
        required={required}
        error={errors?.city}
      />
      <Select
        label={m.filler_field_ward()}
        placeholder={
          wardsLoading ? m.filler_address_wards_loading() : m.filler_ph_ward()
        }
        data={wardOptions}
        value={wardCode || null}
        onChange={handleWardChange}
        searchable
        disabled={disabled || !cityCode || wardsLoading}
        required={required}
        error={errors?.ward}
      />
    </SimpleGrid>
  )
})

export const VietnamAddressFields = memo(function VietnamAddressFields({
  label,
  value,
  onChange,
  disabled = false,
  errors,
  linePlaceholder,
  required,
}: VietnamAddressFieldsProps) {
  const valueRef = useRef(value)
  valueRef.current = value
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const onLocationChange = useCallback((location: LocationFields) => {
    onChangeRef.current({ ...location, line: valueRef.current.line })
  }, [])

  return (
    <Stack gap="sm" aria-label={label}>
      <LocationSelects
        cityCode={value.cityCode}
        wardCode={value.wardCode}
        disabled={disabled}
        errors={errors}
        required={required}
        onLocationChange={onLocationChange}
      />
      <TextInput
        label={m.filler_field_address_line()}
        placeholder={linePlaceholder ?? m.filler_ph_address_line()}
        value={value.line}
        onChange={(event) =>
          onChange({ ...value, line: event.currentTarget.value })
        }
        disabled={disabled}
      />
    </Stack>
  )
})
