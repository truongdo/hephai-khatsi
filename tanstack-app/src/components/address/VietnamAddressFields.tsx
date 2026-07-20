import { Select, SimpleGrid, Stack, TextInput } from '@mantine/core'
import { useEffect, useMemo, useState } from 'react'
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
}

export function VietnamAddressFields({
  label,
  value,
  onChange,
  disabled = false,
  errors,
}: VietnamAddressFieldsProps) {
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
    if (!value.cityCode) {
      setWards([])
      return
    }
    let cancelled = false
    setWardsLoading(true)
    getWards(value.cityCode)
      .then((loaded) => {
        if (!cancelled) setWards(loaded)
      })
      .finally(() => {
        if (!cancelled) setWardsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [value.cityCode])

  const handleCityChange = (cityCode: string | null) => {
    const city = cities.find((item) => item.code === cityCode)
    onChange({
      ...value,
      cityCode: cityCode ?? '',
      cityName: city?.name ?? '',
      wardCode: '',
      wardName: '',
    })
  }

  const handleWardChange = (wardCode: string | null) => {
    const ward = wards.find((item) => item.code === wardCode)
    onChange({
      ...value,
      wardCode: wardCode ?? '',
      wardName: ward?.name ?? '',
    })
  }

  return (
    <Stack gap="sm" aria-label={label}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label={m.filler_field_city()}
          placeholder={m.filler_ph_city()}
          data={cityOptions}
          value={value.cityCode || null}
          onChange={handleCityChange}
          searchable
          disabled={disabled}
          error={errors?.city}
        />
        <Select
          label={m.filler_field_ward()}
          placeholder={
            wardsLoading ? m.filler_address_wards_loading() : m.filler_ph_ward()
          }
          data={wardOptions}
          value={value.wardCode || null}
          onChange={handleWardChange}
          searchable
          disabled={disabled || !value.cityCode || wardsLoading}
          error={errors?.ward}
        />
      </SimpleGrid>
      <TextInput
        label={m.filler_field_address_line()}
        placeholder={m.filler_ph_address_line()}
        value={value.line}
        onChange={(event) =>
          onChange({ ...value, line: event.currentTarget.value })
        }
        disabled={disabled}
      />
    </Stack>
  )
}
