import { Stack, TextInput } from '@mantine/core'
import { useState, useCallback, useEffect } from 'react'
import type { Temple } from '#/domain/types'
import type { AuditActor } from '#/domain/auditLog'
import { m } from '#/paraglide/messages'
import { FormSection } from '../filler/FormSection'
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
} from '../filler/TempleEditorFormSections'
import {
  emptyTempleDraft,
  type TempleDraft,
} from '../filler/templeDraft'
import type { TempleRequiredFieldErrors } from '../filler/templeRequiredValidation'
import { TemplePortraitField } from './TemplePortraitField'

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

function mapPhoneError(
  code: 'REQUIRED' | 'INVALID' | undefined,
): string | undefined {
  if (code === 'REQUIRED') return m.filler_error_field_required()
  if (code === 'INVALID') return m.filler_error_phone_invalid()
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

export type TempleFormFieldsApi = {
  getDraft: () => TempleDraft
  restoreDraft: (fields: Partial<TempleDraft>) => void
  getExtraManagerPhone: () => string
  getPhotoPath: () => string | null
  getPendingPhoto: () => File | null
  setPhotoPath: (path: string | null) => void
  clearPendingPhoto: () => void
  setFieldErrors: (errors: TempleRequiredFieldErrors) => void
  clearFieldErrors: () => void
}

export type TempleFormFieldsProps = {
  initial: Partial<Temple> & { seedPhone?: string }
  disabled?: boolean
  templeId?: string
  inviteToken?: string
  getIdToken?: () => Promise<string | undefined>
  audit?: AuditActor
  onUploadError?: (message: string) => void
  apiRef: React.MutableRefObject<TempleFormFieldsApi | null>
  onDraftChange?: (draft: TempleDraft) => void
}

export function TempleFormFields({
  initial,
  disabled = false,
  templeId,
  inviteToken,
  getIdToken,
  audit,
  onUploadError,
  apiRef,
  onDraftChange,
}: TempleFormFieldsProps) {
  const [draft, setDraft] = useState(() => emptyTempleDraft(initial))
  const restoreDraft = useCallback((fields: Partial<TempleDraft>) => {
    setDraft((current) => ({ ...current, ...fields }))
  }, [])
  const [extraManagerPhone, setExtraManagerPhone] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(
    initial.photoPath ?? null,
  )
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [fieldErrors, setFieldErrors] = useState<TempleRequiredFieldErrors>(
    {},
  )

  apiRef.current = {
    getDraft: () => draft,
    restoreDraft,
    getExtraManagerPhone: () => extraManagerPhone,
    getPhotoPath: () => photoPath,
    getPendingPhoto: () => pendingPhoto,
    setPhotoPath,
    clearPendingPhoto: () => setPendingPhoto(null),
    setFieldErrors,
    clearFieldErrors: () => setFieldErrors({}),
  }

  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft, onDraftChange])

  return (
    <Stack gap="xl" maw={760}>
      <TemplePortraitField
        templeId={templeId}
        inviteToken={inviteToken}
        getIdToken={getIdToken}
        audit={audit}
        photoPath={photoPath}
        photoUpdatedAt={initial.updatedAt ?? null}
        disabled={disabled}
        pendingFile={pendingPhoto}
        onPendingFileChange={setPendingPhoto}
        onPhotoPathChange={setPhotoPath}
        onUploadError={onUploadError}
        required
        error={mapRequiredError(fieldErrors.photo)}
      />
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
          diaChiCu: mapRequiredError(fieldErrors.diaChiCu),
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
            dienThoai: mapPhoneError(fieldErrors.truTriHienNay?.dienThoai),
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
            thucXoaMaNa: mapRequiredError(
              fieldErrors.tangSoHienTru?.thucXoaMaNa,
            ),
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
        errors={{
          qdCongNhanTrangThai: mapRequiredError(
            fieldErrors.qdCongNhanTrangThai,
          ),
        }}
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
          error={
            fieldErrors.extraManagerPhone === 'INVALID'
              ? m.filler_error_phone_invalid()
              : undefined
          }
        />
      </FormSection>
    </Stack>
  )
}
