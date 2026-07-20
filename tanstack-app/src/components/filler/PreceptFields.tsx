import { Fieldset, Stack, TextInput } from '@mantine/core'
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
  const set =
    (key: keyof PreceptRecord) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [key]: e.currentTarget.value })

  return (
    <Fieldset legend={legend} disabled={disabled}>
      <Stack gap="sm">
        <TextInput
          label={m.filler_field_precept_ngay_gh()}
          value={value.ngayGh ?? ''}
          onChange={set('ngayGh')}
        />
        <TextInput
          label={m.filler_field_precept_tai_gh()}
          value={value.taiGh ?? ''}
          onChange={set('taiGh')}
        />
        <TextInput
          label={m.filler_field_precept_ton_hieu()}
          value={value.tonHieuGioiDan ?? ''}
          onChange={set('tonHieuGioiDan')}
        />
        <TextInput
          label={m.filler_field_precept_ngay_hp()}
          value={value.ngayHePhai ?? ''}
          onChange={set('ngayHePhai')}
        />
        <TextInput
          label={m.filler_field_precept_tai_hp()}
          value={value.taiHePhai ?? ''}
          onChange={set('taiHePhai')}
        />
      </Stack>
    </Fieldset>
  )
}
