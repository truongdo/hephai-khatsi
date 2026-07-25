import { Stack, TextInput } from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
import {
  validateTempleRequiredFields,
  type TempleRequiredFieldErrors,
} from './templeRequiredValidation'

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

function mapRequiredError(code: 'REQUIRED' | undefined): string | undefined {
  return code === 'REQUIRED' ? m.filler_error_field_required() : undefined
}

function mapEmailError(
  code: 'REQUIRED' | 'INVALID' | undefined,
): string | undefined {
  if (code === 'REQUIRED') return m.filler_error_field_required()
  if (code === 'INVALID') return m.filler_error_email_invalid()
  return undefined
}

function mapAddressCodeErrors(
  errors?: { city?: 'REQUIRED'; ward?: 'REQUIRED' },
): AddressFieldErrors | undefined {
  if (!errors) return undefined
  return {
    city:
      errors.city === 'REQUIRED'
        ? m.filler_address_city_required()
        : undefined,
    ward:
      errors.ward === 'REQUIRED'
        ? m.filler_address_ward_required()
        : undefined,
  }
}

function mapTienNhiemErrors(
  errors: TempleRequiredFieldErrors['truTriTienNhiem'],
): string | Array<{ phapDanh?: string } | undefined> | undefined {
  if (!errors) return undefined
  if (errors === 'REQUIRED') return m.filler_error_field_required()
  return errors.map((row) =>
    row?.phapDanh === 'REQUIRED'
      ? { phapDanh: m.filler_error_field_required() }
      : undefined,
  )
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
  const [fieldErrors, setFieldErrors] = useState<TempleRequiredFieldErrors>({})
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
    const result = validateTempleRequiredFields({
      danhHieu: draft.danhHieu,
      nguoiKhaiSon: draft.nguoiKhaiSon,
      namThanhLap: draft.namThanhLap,
      diaChiCu: draft.diaChiCu,
      diaChiMoi: draft.diaChiMoi,
      truTriHienNay: draft.truTriHienNay,
      truTriTienNhiem: draft.truTriTienNhiem,
      tangSoHienTru: draft.tangSoHienTru,
      soPhatTuQuyY: draft.soPhatTuQuyY,
      soPhatTuThuongXuyen: draft.soPhatTuThuongXuyen,
    })
    if (!result.valid) {
      setFieldErrors(result.errors)
      return
    }
    setFieldErrors({})
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
          errors={{
            danhHieu: mapRequiredError(fieldErrors.danhHieu),
            nguoiKhaiSon: mapRequiredError(fieldErrors.nguoiKhaiSon),
            namThanhLap: mapRequiredError(fieldErrors.namThanhLap),
          }}
          disabled={disabled}
        />
        <TempleAddressSection
          diaChiCu={draft.diaChiCu}
          diaChiMoi={draft.diaChiMoi}
          setDraft={setDraft}
          errors={{
            diaChiCu: mapAddressCodeErrors(fieldErrors.diaChiCu),
            diaChiMoi: mapAddressCodeErrors(fieldErrors.diaChiMoi),
          }}
          disabled={disabled}
        />
        <TempleTruTriSection
          truTriHienNay={draft.truTriHienNay}
          truTriTienNhiem={draft.truTriTienNhiem}
          setDraft={setDraft}
          errors={{
            truTriHienNay: {
              phapDanh: mapRequiredError(fieldErrors.truTriHienNay?.phapDanh),
              dienThoai: mapRequiredError(fieldErrors.truTriHienNay?.dienThoai),
              email: mapEmailError(fieldErrors.truTriHienNay?.email),
            },
            truTriTienNhiem: mapTienNhiemErrors(fieldErrors.truTriTienNhiem),
          }}
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
          errors={{
            tangSoHienTru: {
              tyKheo: mapRequiredError(fieldErrors.tangSoHienTru?.tyKheo),
              thucXoaMaNa: mapRequiredError(fieldErrors.tangSoHienTru?.thucXoaMaNa),
              saDi: mapRequiredError(fieldErrors.tangSoHienTru?.saDi),
              tapSu: mapRequiredError(fieldErrors.tangSoHienTru?.tapSu),
            },
            soPhatTuQuyY: mapRequiredError(fieldErrors.soPhatTuQuyY),
            soPhatTuThuongXuyen: mapRequiredError(
              fieldErrors.soPhatTuThuongXuyen,
            ),
          }}
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
