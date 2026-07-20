import { Stack, TextInput } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { validateAddressDraft } from '#/domain/address'
import type { Temple } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import { saveTempleDraft } from '#/use-cases/saveTempleDraft'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import { FormSection } from './FormSection'
import {
  TempleAddressSection,
  TempleBanQuanTriSection,
  TempleDatSection,
  TempleHoatDongSection,
  TempleIdentitySection,
  TempleQuyetDinhSection,
  TempleTangSoSection,
  TempleTruTriSection,
  TempleXayDungSection,
} from './TempleEditorFormSections'
import { buildTemplePatch, emptyTempleDraft } from './templeDraft'

export type TempleEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  templeId?: string
  initial: Partial<Temple> & { seedPhone?: string }
  status: FillerEditorStatus
  onCreated: (templeId: string) => void
}

type AddressFieldErrors = { city?: string; ward?: string }

function mapAddressErrors(
  result: ReturnType<typeof validateAddressDraft>,
): AddressFieldErrors | undefined {
  if (result.valid) return undefined
  return {
    city:
      result.errors.city === 'REQUIRED'
        ? m.filler_address_city_required()
        : undefined,
    ward:
      result.errors.ward === 'REQUIRED'
        ? m.filler_address_ward_required()
        : undefined,
  }
}

export function TempleEditorForm({
  title,
  token,
  orgUnitId,
  templeId,
  initial,
  status,
  onCreated,
}: TempleEditorFormProps) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState(() => emptyTempleDraft(initial))
  const [extraManagerPhone, setExtraManagerPhone] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [addressErrors, setAddressErrors] = useState<{
    diaChiCu?: AddressFieldErrors
    diaChiMoi?: AddressFieldErrors
  }>({})
  const disabled = status === 'view'

  const saveMutation = useMutation({
    mutationFn: () =>
      saveTempleDraft({
        token,
        orgUnitId,
        templeId,
        patch: buildTemplePatch(draft),
        explicitPhones: extraManagerPhone.trim()
          ? [extraManagerPhone.trim()]
          : [],
      }),
    onSuccess: async (result) => {
      setSaveError(null)
      if (result.mode === 'created') {
        onCreated(result.temple.id)
        return
      }
      setSaveSuccess(m.filler_save_success())
      await queryClient.invalidateQueries({
        queryKey: fillerKeys.temple(result.temple.id),
      })
    },
    onError: () => {
      setSaveSuccess(null)
      setSaveError(m.filler_save_error())
    },
  })

  const handleSave = () => {
    const cu = validateAddressDraft(draft.diaChiCu)
    const moi = validateAddressDraft(draft.diaChiMoi)
    setAddressErrors({
      diaChiCu: mapAddressErrors(cu),
      diaChiMoi: mapAddressErrors(moi),
    })
    if (!cu.valid || !moi.valid) return
    saveMutation.mutate()
  }

  return (
    <FillerEditorShell
      title={title}
      status={status}
      onSave={status === 'draft' ? handleSave : undefined}
      savePending={saveMutation.isPending}
      saveError={saveError}
      saveSuccess={saveSuccess}
    >
      <Stack gap="xl" maw={760}>
        <TempleIdentitySection
          danhHieu={draft.danhHieu}
          nguoiKhaiSon={draft.nguoiKhaiSon}
          namThanhLap={draft.namThanhLap}
          tinChuHienCung={draft.tinChuHienCung}
          dacDiem={draft.dacDiem}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleAddressSection
          diaChiCu={draft.diaChiCu}
          diaChiMoi={draft.diaChiMoi}
          setDraft={setDraft}
          errors={addressErrors}
          disabled={disabled}
        />
        <TempleTruTriSection
          truTriHienNay={draft.truTriHienNay}
          truTriTienNhiem={draft.truTriTienNhiem}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleBanQuanTriSection
          banQuanTri={draft.banQuanTri}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleTangSoSection
          tangSoHienTru={draft.tangSoHienTru}
          soPhatTuQuyY={draft.soPhatTuQuyY}
          soPhatTuThuongXuyen={draft.soPhatTuThuongXuyen}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleHoatDongSection
          hoatDongPhatSu={draft.hoatDongPhatSu}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleQuyetDinhSection
          qdCongNhan={draft.qdCongNhan}
          qdBoNhiemTruTri={draft.qdBoNhiemTruTri}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleXayDungSection
          moHinhKienTruc={draft.moHinhKienTruc}
          hangMucXayDung={draft.hangMucXayDung}
          trungTu={draft.trungTu}
          setDraft={setDraft}
          disabled={disabled}
        />
        <TempleDatSection
          quyenSuDungDat={draft.quyenSuDungDat}
          setDraft={setDraft}
          disabled={disabled}
        />
        <FormSection title={m.filler_section_temple_phones()}>
          <TextInput
            label={m.filler_field_manager_phone()}
            placeholder={m.filler_ph_phone()}
            value={extraManagerPhone}
            onChange={(event) =>
              setExtraManagerPhone(event.currentTarget.value)
            }
            disabled={disabled}
          />
        </FormSection>
      </Stack>
    </FillerEditorShell>
  )
}
