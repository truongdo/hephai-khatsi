import { Fieldset, Stack, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import type { PreceptRecord } from '#/domain/types'
import { m } from '#/paraglide/messages'

export function PreceptFields({
  legend,
  value,
  onChange,
  disabled,
}: {
  legend: string
  value: PreceptRecord
  onChange: (next: PreceptRecord) => void
  disabled?: boolean
}) {
  const setText =
    (key: keyof PreceptRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.currentTarget.value })

  return (
    <Fieldset legend={legend} disabled={disabled}>
      <Stack gap="sm">
        <DateInput
          label={m.filler_field_precept_ngay_gh()}
          valueFormat="YYYY-MM-DD"
          clearable
          value={value.ngayGh || null}
          onChange={(next) => onChange({ ...value, ngayGh: next ?? '' })}
        />
        <TextInput
          label={m.filler_field_precept_tai_gh()}
          placeholder={m.filler_ph_precept_tai()}
          value={value.taiGh ?? ''}
          onChange={setText('taiGh')}
        />
        <TextInput
          label={m.filler_field_precept_ton_hieu()}
          placeholder={m.filler_ph_precept_ton_hieu()}
          value={value.tonHieuGioiDan ?? ''}
          onChange={setText('tonHieuGioiDan')}
        />
        <DateInput
          label={m.filler_field_precept_ngay_hp()}
          valueFormat="YYYY-MM-DD"
          placeholder={m.filler_field_precept_ngay_hp_placeholder()}
          clearable
          value={value.ngayHePhai || null}
          onChange={(next) => onChange({ ...value, ngayHePhai: next ?? '' })}
        />
        <TextInput
          label={m.filler_field_precept_tai_hp()}
          placeholder={m.filler_ph_precept_tai_he_phai()}
          value={value.taiHePhai ?? ''}
          onChange={setText('taiHePhai')}
        />
      </Stack>
    </Fieldset>
  )
}
