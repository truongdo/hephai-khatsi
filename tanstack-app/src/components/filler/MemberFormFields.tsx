import {
  Button,
  Fieldset,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { DateInput, MonthPickerInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { VietnamAddressFields } from '#/components/address/VietnamAddressFields'
import type { AddressDraft } from '#/domain/address'
import type { MemberDocuments } from '#/domain/memberDocumentTypes'
import type { Member, SanghaType } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerOrgUnitsQuery } from '#/query/fillerQueries'
import type { FillerOption } from './fillerFormOptions'
import {
  namTienPhongAfterRankChange,
  NI_RANKS,
  rankShowsNamTienPhong,
  TANG_RANKS,
} from './fillerFormOptions'
import { FormSection } from './FormSection'
import {
  EMPTY_ANH_CHI_EM,
  EMPTY_CHUC_VU,
  EMPTY_KHOA_TU,
  emptyMemberDraft,
  type AnhChiEmRow,
  type ChucVuRow,
  type FamilyPersonDraft,
  type KhoaTuRow,
  type MemberDraft,
  type NumericValue,
} from './memberDraft'
import {
  MemberDocumentsField,
  type PendingDocumentFiles,
} from './MemberDocumentsField'
import { MemberPortraitField } from './MemberPortraitField'
import type { MemberRequiredFieldErrors } from './memberRequiredValidation'
import { PreceptFields } from './PreceptFields'
import { RepeatableFieldset } from './RepeatableFieldset'

function mapAddressErrors(errors?: {
  city?: 'REQUIRED'
  ward?: 'REQUIRED'
  line?: 'REQUIRED'
}) {
  return {
    city:
      errors?.city === 'REQUIRED'
        ? m.filler_address_city_required()
        : undefined,
    ward:
      errors?.ward === 'REQUIRED'
        ? m.filler_address_ward_required()
        : undefined,
    line:
      errors?.line === 'REQUIRED'
        ? m.filler_error_field_required()
        : undefined,
  }
}

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

function mapCccdError(
  code: 'REQUIRED' | 'INVALID' | undefined,
): string | undefined {
  if (code === 'REQUIRED') return m.filler_error_field_required()
  if (code === 'INVALID') return m.filler_error_cccd_invalid()
  return undefined
}

function optionData(options: FillerOption[]) {
  return options.map((option) => ({
    value: option.value,
    label: option.label(),
  }))
}

function rankOptions(sanghaType: SanghaType) {
  return optionData(sanghaType === 'tang' ? TANG_RANKS : NI_RANKS)
}

const MONTH_YEAR_RE = /^\d{4}-\d{2}$/

function toMonthPickerValue(value: string): string | null {
  if (MONTH_YEAR_RE.test(value)) return `${value}-01`
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value.slice(0, 7)}-01`
  return null
}

function fromMonthPickerValue(value: string | null): string {
  return value ? value.slice(0, 7) : ''
}

function numberInputValue(value: string | number): NumericValue {
  return typeof value === 'number' ? value : ''
}

export type MemberFormFieldsApi = {
  getDraft: () => MemberDraft
  restoreDraft: (fields: Partial<MemberDraft>) => void
  getPhotoPath: () => string | null
  getPendingPhoto: () => File | null
  setPhotoPath: (path: string | null) => void
  clearPendingPhoto: () => void
  getDocuments: () => MemberDocuments
  setDocuments: (docs: MemberDocuments) => void
  getPendingDocuments: () => PendingDocumentFiles
  clearPendingDocuments: () => void
  setFieldErrors: (errors: MemberRequiredFieldErrors) => void
  clearFieldErrors: () => void
}

export type MemberFormFieldsProps = {
  initial: Partial<Member>
  disabled?: boolean
  memberId?: string
  cccd: string
  onCccdChange?: (value: string) => void
  sanghaType: SanghaType
  inviteToken?: string
  getIdToken?: () => Promise<string | undefined>
  apiRef: React.MutableRefObject<MemberFormFieldsApi | null>
  onUploadError?: (message: string) => void
  onDraftChange?: (draft: MemberDraft) => void
}

export function MemberFormFields({
  initial,
  disabled = false,
  memberId,
  cccd,
  onCccdChange,
  sanghaType,
  inviteToken,
  getIdToken,
  onUploadError,
  apiRef,
  onDraftChange,
}: MemberFormFieldsProps) {
  const [draft, setDraft] = useState(() => emptyMemberDraft(initial))
  const [photoPath, setPhotoPath] = useState<string | null>(
    initial.photoPath ?? null,
  )
  const [pendingPhoto, setPendingPhoto] = useState<File | null>(null)
  const [documents, setDocuments] = useState<MemberDocuments>(
    initial.documents ?? {},
  )
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocumentFiles>(
    {},
  )
  const [fieldErrors, setFieldErrors] = useState<MemberRequiredFieldErrors>({})
  const restoreDraft = useCallback((fields: Partial<MemberDraft>) => {
    setDraft((current) => ({ ...current, ...fields }))
  }, [])
  const ranks = useMemo(() => rankOptions(sanghaType), [sanghaType])
  const orgUnitsQuery = useQuery(fillerOrgUnitsQuery())
  const giaoDoanOptions = useMemo(
    () =>
      (orgUnitsQuery.data ?? [])
        .filter((unit) => unit.kind === 'giao_doan')
        .map((unit) => ({ value: unit.id, label: unit.name })),
    [orgUnitsQuery.data],
  )

  apiRef.current = {
    getDraft: () => draft,
    restoreDraft,
    getPhotoPath: () => photoPath,
    getPendingPhoto: () => pendingPhoto,
    setPhotoPath,
    clearPendingPhoto: () => setPendingPhoto(null),
    getDocuments: () => documents,
    setDocuments,
    getPendingDocuments: () => pendingDocuments,
    clearPendingDocuments: () => setPendingDocuments({}),
    setFieldErrors,
    clearFieldErrors: () => setFieldErrors({}),
  }

  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft, onDraftChange])

  const updateDraft = <K extends keyof MemberDraft>(
    key: K,
    value: MemberDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const updateNested = <
    K extends keyof MemberDraft,
    F extends keyof MemberDraft[K],
  >(
    key: K,
    field: F,
    value: MemberDraft[K][F],
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: { ...(current[key] as object), [field]: value },
    }))

  const updateGiaoPhamRank = (
    key: 'giaoPhamGiaoHoi' | 'giaoPhamHePhai',
    rank: string,
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        rank,
        namTienPhong: namTienPhongAfterRankChange(
          rank,
          current[key].namTienPhong,
        ),
      },
    }))

  const updateFamilyPerson = (
    person: 'cha' | 'me',
    field: keyof FamilyPersonDraft,
    value: string,
  ) =>
    setDraft((current) => ({
      ...current,
      giaDinh: {
        ...current.giaDinh,
        [person]: { ...current.giaDinh[person], [field]: value },
      },
    }))

  const updateChucVuRow = (
    key: 'chucVuHePhai' | 'chucVuGhpgvn',
    index: number,
    row: ChucVuRow,
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) =>
        itemIndex === index ? row : item,
      ),
    }))

  const addChucVuRow = (key: 'chucVuHePhai' | 'chucVuGhpgvn') =>
    setDraft((current) => ({
      ...current,
      [key]: [...current[key], EMPTY_CHUC_VU],
    }))

  const removeChucVuRow = (
    key: 'chucVuHePhai' | 'chucVuGhpgvn',
    index: number,
  ) =>
    setDraft((current) => {
      const nextRows = current[key].filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        [key]: nextRows.length > 0 ? nextRows : [EMPTY_CHUC_VU],
      }
    })

  const updateKhoaTuRow = (index: number, row: KhoaTuRow) =>
    setDraft((current) => ({
      ...current,
      khoaTu: current.khoaTu.map((item, itemIndex) =>
        itemIndex === index ? row : item,
      ),
    }))

  const addKhoaTuRow = () =>
    setDraft((current) => ({
      ...current,
      khoaTu: [...current.khoaTu, EMPTY_KHOA_TU],
    }))

  const removeKhoaTuRow = (index: number) =>
    setDraft((current) => {
      const nextRows = current.khoaTu.filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        khoaTu: nextRows.length > 0 ? nextRows : [EMPTY_KHOA_TU],
      }
    })

  const updateAnhChiEmRow = (index: number, row: AnhChiEmRow) =>
    setDraft((current) => ({
      ...current,
      giaDinh: {
        ...current.giaDinh,
        anhChiEm: current.giaDinh.anhChiEm.map((item, itemIndex) =>
          itemIndex === index ? row : item,
        ),
      },
    }))

  const addAnhChiEmRow = () =>
    setDraft((current) => {
      return {
        ...current,
        giaDinh: {
          ...current.giaDinh,
          anhChiEm: [...current.giaDinh.anhChiEm, EMPTY_ANH_CHI_EM],
        },
      }
    })

  const removeAnhChiEmRow = (index: number) =>
    setDraft((current) => {
      const nextRows = current.giaDinh.anhChiEm.filter(
        (_, itemIndex) => itemIndex !== index,
      )
      return {
        ...current,
        giaDinh: {
          ...current.giaDinh,
          anhChiEm: nextRows.length > 0 ? nextRows : [EMPTY_ANH_CHI_EM],
        },
      }
    })

  const onDiaChiThuongTruChange = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, diaChiThuongTru: value })),
    [],
  )

  const onNoiSinhChange = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, noiSinh: value })),
    [],
  )

  const onNoiXuatGiaChange = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, noiXuatGia: value })),
    [],
  )

  const identitySection = useMemo(
    () => (
      <FormSection title={m.filler_section_identity()}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={m.filler_field_the_danh()}
            placeholder={m.filler_ph_the_danh()}
            value={draft.theDanh}
            onChange={(event) =>
              updateDraft('theDanh', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.theDanh)}
          />
          <TextInput
            label={m.filler_field_phap_danh()}
            placeholder={m.filler_ph_phap_danh_member()}
            value={draft.phapDanh}
            onChange={(event) =>
              updateDraft('phapDanh', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.phapDanh)}
          />
          <DateInput
            label={m.filler_field_ngay_sinh()}
            valueFormat="DD-MM-YYYY"
            placeholder={m.filler_ph_date_dmy()}
            clearable
            value={draft.ngaySinh || null}
            onChange={(value) => updateDraft('ngaySinh', value ?? '')}
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.ngaySinh)}
          />
          <VietnamAddressFields
            label={m.filler_field_noi_sinh()}
            value={draft.noiSinh}
            onChange={onNoiSinhChange}
            disabled={disabled}
            required
            cityOnly
            errors={mapAddressErrors(fieldErrors.noiSinh)}
          />
          <TextInput
            label={m.filler_field_nguyen_quan()}
            placeholder={m.filler_ph_nguyen_quan()}
            value={draft.nguyenQuan}
            onChange={(event) =>
              updateDraft('nguyenQuan', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_dan_toc()}
            placeholder={m.filler_ph_dan_toc()}
            value={draft.danToc}
            onChange={(event) =>
              updateDraft('danToc', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cccd()}
            placeholder={m.filler_ph_cccd()}
            value={cccd}
            onChange={
              onCccdChange
                ? (event) => onCccdChange(event.currentTarget.value)
                : undefined
            }
            disabled={disabled || !onCccdChange}
            required={!!onCccdChange}
            error={mapCccdError(fieldErrors.cccd)}
          />
          <DateInput
            label={m.filler_field_cccd_ngay_cap()}
            valueFormat="DD-MM-YYYY"
            placeholder={m.filler_ph_date_dmy()}
            clearable
            value={draft.cccdMeta.ngayCap || null}
            onChange={(value) =>
              updateNested('cccdMeta', 'ngayCap', value ?? '')
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cccd_noi_cap()}
            placeholder={m.filler_ph_noi_cap()}
            value={draft.cccdMeta.noiCap}
            onChange={(event) =>
              updateNested('cccdMeta', 'noiCap', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cntn_so()}
            placeholder={m.filler_ph_cntn_so()}
            value={draft.cntn.so}
            onChange={(event) =>
              updateNested('cntn', 'so', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <DateInput
            label={m.filler_field_cntn_ngay_cap()}
            valueFormat="DD-MM-YYYY"
            placeholder={m.filler_ph_date_dmy()}
            clearable
            value={draft.cntn.ngayCap || null}
            onChange={(value) => updateNested('cntn', 'ngayCap', value ?? '')}
            disabled={disabled}
          />
          <TextInput
            label={m.filler_field_cntn_noi_cap()}
            placeholder={m.filler_ph_noi_cap_cntn()}
            value={draft.cntn.noiCap}
            onChange={(event) =>
              updateNested('cntn', 'noiCap', event.currentTarget.value)
            }
            disabled={disabled}
          />
        </SimpleGrid>
      </FormSection>
    ),
    [
      draft.theDanh,
      draft.phapDanh,
      draft.ngaySinh,
      draft.noiSinh,
      draft.nguyenQuan,
      draft.cccdMeta,
      draft.cntn,
      draft.danToc,
      cccd,
      onCccdChange,
      disabled,
      onNoiSinhChange,
      fieldErrors.theDanh,
      fieldErrors.phapDanh,
      fieldErrors.ngaySinh,
      fieldErrors.noiSinh,
      fieldErrors.cccd,
    ],
  )

  const contactSection = useMemo(
    () => (
      <FormSection title={m.filler_section_contact()}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={m.filler_field_dien_thoai()}
            placeholder={m.filler_ph_phone()}
            value={draft.dienThoai}
            onChange={(event) =>
              updateDraft('dienThoai', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapPhoneError(fieldErrors.dienThoai)}
          />
          <TextInput
            label={m.filler_field_email()}
            placeholder={m.filler_ph_email()}
            value={draft.email}
            onChange={(event) =>
              updateDraft('email', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapEmailError(fieldErrors.email)}
          />
        </SimpleGrid>
        <Stack gap="xs">
          <Stack gap={2}>
            <Text fw={600}>{m.filler_field_dia_chi_thuong_tru()}</Text>
            <Text size="xs" c="dimmed">
              {m.filler_desc_dia_chi_thuong_tru()}
            </Text>
          </Stack>
          <VietnamAddressFields
            label={m.filler_field_dia_chi_thuong_tru()}
            value={draft.diaChiThuongTru}
            onChange={onDiaChiThuongTruChange}
            disabled={disabled}
            required
            errors={mapAddressErrors(fieldErrors.diaChiThuongTru)}
          />
        </Stack>
      </FormSection>
    ),
    [
      draft.dienThoai,
      draft.email,
      draft.diaChiThuongTru,
      onDiaChiThuongTruChange,
      fieldErrors.dienThoai,
      fieldErrors.email,
      fieldErrors.diaChiThuongTru,
      disabled,
    ],
  )

  const renderChucVuRows = (key: 'chucVuHePhai' | 'chucVuGhpgvn') =>
    draft[key].map((row, index) => (
      <Fieldset
        key={index}
        legend={`${key === 'chucVuHePhai' ? m.filler_field_chuc_vu_he_phai() : m.filler_field_chuc_vu_ghpgvn()} ${index + 1}`}
        disabled={disabled}
      >
        <Stack>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <MonthPickerInput
              label={m.filler_field_tu_thang_nam()}
              valueFormat="MM/YYYY"
              clearable
              value={toMonthPickerValue(row.tuThangNam)}
              onChange={(value) =>
                updateChucVuRow(key, index, {
                  ...row,
                  tuThangNam: fromMonthPickerValue(value),
                })
              }
            />
            <MonthPickerInput
              label={m.filler_field_den_thang_nam()}
              valueFormat="MM/YYYY"
              clearable
              value={toMonthPickerValue(row.denThangNam)}
              onChange={(value) =>
                updateChucVuRow(key, index, {
                  ...row,
                  denThangNam: fromMonthPickerValue(value),
                })
              }
            />
            <TextInput
              label={m.filler_field_noi_dung()}
              description={
                key === 'chucVuHePhai'
                  ? m.filler_desc_noi_dung()
                  : m.filler_desc_noi_dung_ghpgvn()
              }
              placeholder={
                key === 'chucVuHePhai'
                  ? m.filler_ph_noi_dung_he_phai()
                  : m.filler_ph_noi_dung_ghpgvn()
              }
              value={row.noiDung}
              onChange={(event) =>
                updateChucVuRow(key, index, {
                  ...row,
                  noiDung: event.currentTarget.value,
                })
              }
            />
            <TextInput
              label={m.filler_field_dia_chi()}
              placeholder={
                key === 'chucVuHePhai'
                  ? m.filler_ph_dia_chi_he_phai()
                  : m.filler_ph_dia_chi_ghpgvn()
              }
              value={row.diaChi}
              onChange={(event) =>
                updateChucVuRow(key, index, {
                  ...row,
                  diaChi: event.currentTarget.value,
                })
              }
            />
          </SimpleGrid>
          <Button
            type="button"
            variant="subtle"
            color="red"
            onClick={() => removeChucVuRow(key, index)}
            disabled={disabled}
          >
            {m.filler_remove_row()}
          </Button>
        </Stack>
      </Fieldset>
    ))

  const restSections = useMemo(
    () => (
      <>
        <FormSection title={m.filler_section_xuat_gia()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DateInput
              label={m.filler_field_ngay_xuat_gia()}
              valueFormat="DD-MM-YYYY"
              placeholder={m.filler_ph_date_dmy()}
              clearable
              value={draft.ngayXuatGia || null}
              onChange={(value) => updateDraft('ngayXuatGia', value ?? '')}
              disabled={disabled}
              required
              error={mapRequiredError(fieldErrors.ngayXuatGia)}
            />
            <Stack gap="xs">
              <Stack gap={2}>
                <Text fw={600}>{m.filler_field_noi_xuat_gia()}</Text>
                <Text size="xs" c="dimmed">
                  {m.filler_desc_noi_xuat_gia()}
                </Text>
              </Stack>
              <VietnamAddressFields
                label={m.filler_field_noi_xuat_gia()}
                value={draft.noiXuatGia}
                onChange={onNoiXuatGiaChange}
                disabled={disabled}
                required
                lineLabel={m.filler_field_noi_xuat_gia_line()}
                lineRequired
                linePlaceholder={m.filler_ph_noi_xuat_gia_line()}
                errors={mapAddressErrors(fieldErrors.noiXuatGia)}
              />
            </Stack>
            <TextInput
              label={m.filler_field_bon_su()}
              description={m.filler_desc_bon_su()}
              placeholder={m.filler_ph_bon_su()}
              value={draft.bonSu}
              onChange={(event) =>
                updateDraft('bonSu', event.currentTarget.value)
              }
              disabled={disabled}
              required
              error={mapRequiredError(fieldErrors.bonSu)}
            />
            <TextInput
              label={m.filler_field_he_phai_goc()}
              description={m.filler_desc_he_phai_goc()}
              placeholder={m.filler_ph_he_phai_goc()}
              value={draft.hePhaiGoc}
              onChange={(event) =>
                updateDraft('hePhaiGoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <Select
              label={m.filler_field_giao_doan_goc()}
              description={m.filler_desc_giao_doan_goc()}
              placeholder={m.filler_org_placeholder()}
              data={giaoDoanOptions}
              value={
                giaoDoanOptions.some(
                  (option) => option.value === draft.giaoDoanGoc,
                )
                  ? draft.giaoDoanGoc || null
                  : null
              }
              onChange={(value) => updateDraft('giaoDoanGoc', value ?? '')}
              searchable
              clearable
              disabled={disabled}
            />
            <NumberInput
              label={m.filler_field_ha_lap()}
              description={m.filler_desc_ha_lap()}
              placeholder={m.filler_ph_number()}
              value={draft.haLap}
              onChange={(value) =>
                updateDraft('haLap', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
          </SimpleGrid>
          <TextInput
            label={m.filler_field_hien_tu_hoc()}
            description={m.filler_desc_hien_tu_hoc()}
            placeholder={m.filler_ph_hien_tu_hoc()}
            value={draft.hienTuHoc}
            onChange={(event) =>
              updateDraft('hienTuHoc', event.currentTarget.value)
            }
            disabled={disabled}
            required
            error={mapRequiredError(fieldErrors.hienTuHoc)}
          />
        </FormSection>

        <FormSection title={m.filler_section_gioi()}>
          {sanghaType === 'tang' ? (
            <>
              <PreceptFields
                legend={m.filler_field_gioi_sa_di()}
                value={draft.gioiSaDi}
                onChange={(value) => updateDraft('gioiSaDi', value)}
                disabled={disabled}
              />
              <PreceptFields
                legend={m.filler_field_gioi_ty_kheo()}
                value={draft.gioiTyKheo}
                onChange={(value) => updateDraft('gioiTyKheo', value)}
                disabled={disabled}
              />
            </>
          ) : (
            <>
              <PreceptFields
                legend={m.filler_field_gioi_sa_di_ni()}
                value={draft.gioiSaDiNi}
                onChange={(value) => updateDraft('gioiSaDiNi', value)}
                disabled={disabled}
              />
              <PreceptFields
                legend={m.filler_field_gioi_thuc_xoa()}
                value={draft.gioiThucXoaMaNa}
                onChange={(value) => updateDraft('gioiThucXoaMaNa', value)}
                disabled={disabled}
              />
              <PreceptFields
                legend={m.filler_field_gioi_ty_kheo_ni()}
                value={draft.gioiTyKheoNi}
                onChange={(value) => updateDraft('gioiTyKheoNi', value)}
                disabled={disabled}
              />
            </>
          )}
        </FormSection>

        <FormSection title={m.filler_section_pham_vi()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Fieldset legend={m.filler_field_gp_giao_hoi()} disabled={disabled}>
              <Stack>
                <Select
                  label={m.filler_field_rank()}
                  data={ranks}
                  value={draft.giaoPhamGiaoHoi.rank || null}
                  onChange={(value) =>
                    updateGiaoPhamRank('giaoPhamGiaoHoi', value ?? '')
                  }
                  required
                  error={mapRequiredError(fieldErrors.giaoPhamGiaoHoi?.rank)}
                />
                {rankShowsNamTienPhong(draft.giaoPhamGiaoHoi.rank) ? (
                  <NumberInput
                    label={m.filler_field_nam_tien_phong()}
                    placeholder={m.filler_ph_year()}
                    value={draft.giaoPhamGiaoHoi.namTienPhong}
                    onChange={(value) =>
                      updateNested(
                        'giaoPhamGiaoHoi',
                        'namTienPhong',
                        numberInputValue(value),
                      )
                    }
                    min={0}
                  />
                ) : null}
              </Stack>
            </Fieldset>
            <Fieldset legend={m.filler_field_gp_he_phai()} disabled={disabled}>
              <Stack>
                <Select
                  label={m.filler_field_rank()}
                  data={ranks}
                  value={draft.giaoPhamHePhai.rank || null}
                  onChange={(value) =>
                    updateGiaoPhamRank('giaoPhamHePhai', value ?? '')
                  }
                  required
                  error={mapRequiredError(fieldErrors.giaoPhamHePhai?.rank)}
                />
                {rankShowsNamTienPhong(draft.giaoPhamHePhai.rank) ? (
                  <NumberInput
                    label={m.filler_field_nam_tien_phong()}
                    placeholder={m.filler_ph_year()}
                    value={draft.giaoPhamHePhai.namTienPhong}
                    onChange={(value) =>
                      updateNested(
                        'giaoPhamHePhai',
                        'namTienPhong',
                        numberInputValue(value),
                      )
                    }
                    min={0}
                  />
                ) : null}
              </Stack>
            </Fieldset>
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_hoc_van()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_trinh_do_the_hoc()}
              placeholder={m.filler_ph_trinh_do()}
              value={draft.trinhDoTheHoc}
              onChange={(event) =>
                updateDraft('trinhDoTheHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_ngoai_ngu()}
              placeholder={m.filler_ph_ngoai_ngu()}
              value={draft.ngoaiNgu}
              onChange={(event) =>
                updateDraft('ngoaiNgu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_trinh_do_chuyen_mon()}
              placeholder={m.filler_ph_chuyen_mon()}
              value={draft.trinhDoChuyenMon}
              onChange={(event) =>
                updateDraft('trinhDoChuyenMon', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_cap_bac()}
              placeholder={m.filler_ph_cap_bac()}
              value={draft.capBac}
              onChange={(event) =>
                updateDraft('capBac', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_trinh_do_phat_hoc()}
              placeholder={m.filler_ph_phat_hoc()}
              value={draft.trinhDoPhatHoc}
              onChange={(event) =>
                updateDraft('trinhDoPhatHoc', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_co_ngu()}
              placeholder={m.filler_ph_co_ngu()}
              value={draft.coNgu}
              onChange={(event) =>
                updateDraft('coNgu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_hoc_vi()}
              placeholder={m.filler_ph_hoc_vi()}
              value={draft.hocViHocHam}
              onChange={(event) =>
                updateDraft('hocViHocHam', event.currentTarget.value)
              }
              disabled={disabled}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_chuc_vu()}>
          <RepeatableFieldset
            label={m.filler_field_chuc_vu_he_phai()}
            addLabel={m.filler_add_row()}
            onAdd={() => addChucVuRow('chucVuHePhai')}
            disabled={disabled}
          >
            {renderChucVuRows('chucVuHePhai')}
          </RepeatableFieldset>
          <RepeatableFieldset
            label={m.filler_field_chuc_vu_ghpgvn()}
            addLabel={m.filler_add_row()}
            onAdd={() => addChucVuRow('chucVuGhpgvn')}
            disabled={disabled}
          >
            {renderChucVuRows('chucVuGhpgvn')}
          </RepeatableFieldset>
          <TextInput
            label={m.filler_field_chuc_vu_doan_the()}
            description={m.filler_desc_chuc_vu_doan_the()}
            placeholder={m.filler_ph_chuc_vu_doan_the()}
            value={draft.chucVuDoanThe}
            onChange={(event) =>
              updateDraft('chucVuDoanThe', event.currentTarget.value)
            }
            disabled={disabled}
          />
        </FormSection>
      </>
    ),
    [
      draft.ngayXuatGia,
      draft.noiXuatGia,
      draft.hienTuHoc,
      draft.bonSu,
      draft.hePhaiGoc,
      draft.giaoDoanGoc,
      draft.haLap,
      draft.gioiSaDi,
      draft.gioiTyKheo,
      draft.gioiSaDiNi,
      draft.gioiThucXoaMaNa,
      draft.gioiTyKheoNi,
      draft.giaoPhamGiaoHoi,
      draft.giaoPhamHePhai,
      draft.trinhDoTheHoc,
      draft.ngoaiNgu,
      draft.trinhDoChuyenMon,
      draft.capBac,
      draft.trinhDoPhatHoc,
      draft.coNgu,
      draft.hocViHocHam,
      draft.chucVuHePhai,
      draft.chucVuGhpgvn,
      draft.chucVuDoanThe,
      sanghaType,
      ranks,
      giaoDoanOptions,
      disabled,
      onNoiXuatGiaChange,
      fieldErrors.ngayXuatGia,
      fieldErrors.hienTuHoc,
      fieldErrors.bonSu,
      fieldErrors.noiXuatGia,
      fieldErrors.giaoPhamGiaoHoi,
      fieldErrors.giaoPhamHePhai,
    ],
  )

  const tailSections = useMemo(
    () => (
      <>
        <FormSection title={m.filler_section_khoa_tu()}>
          <RepeatableFieldset
            label={m.filler_section_khoa_tu()}
            addLabel={m.filler_add_row()}
            onAdd={addKhoaTuRow}
            disabled={disabled}
          >
            {draft.khoaTu.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_section_khoa_tu()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label={m.filler_field_khoa_tu_ten()}
                      description={m.filler_desc_khoa_tu_ten()}
                      placeholder={m.filler_ph_khoa_tu_ten()}
                      value={row.ten}
                      onChange={(event) =>
                        updateKhoaTuRow(index, {
                          ...row,
                          ten: event.currentTarget.value,
                        })
                      }
                    />
                    <NumberInput
                      label={m.filler_field_khoa_tu_so_lan()}
                      placeholder={m.filler_ph_number()}
                      value={row.soLan}
                      onChange={(value) =>
                        updateKhoaTuRow(index, {
                          ...row,
                          soLan: numberInputValue(value),
                        })
                      }
                      min={0}
                    />
                    <TextInput
                      label={m.filler_field_ghi_chu()}
                      placeholder={m.filler_ph_khoa_tu_ghi_chu()}
                      value={row.ghiChu}
                      onChange={(event) =>
                        updateKhoaTuRow(index, {
                          ...row,
                          ghiChu: event.currentTarget.value,
                        })
                      }
                    />
                  </SimpleGrid>
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    onClick={() => removeKhoaTuRow(index)}
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_gia_dinh()}>
          {(['cha', 'me'] as const).map((person) => (
            <Fieldset
              key={person}
              legend={
                person === 'cha' ? m.filler_field_cha() : m.filler_field_me()
              }
              disabled={disabled}
            >
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label={m.filler_field_ho_ten()}
                  placeholder={m.filler_ph_ho_ten()}
                  value={draft.giaDinh[person].hoTen}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'hoTen',
                      event.currentTarget.value,
                    )
                  }
                  required
                  error={mapRequiredError(
                    fieldErrors.giaDinh?.[person]?.hoTen,
                  )}
                />
                <TextInput
                  label={m.filler_field_nam_sinh()}
                  placeholder={m.filler_ph_nam_sinh()}
                  value={draft.giaDinh[person].namSinh}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'namSinh',
                      event.currentTarget.value,
                    )
                  }
                  required
                  error={mapRequiredError(
                    fieldErrors.giaDinh?.[person]?.namSinh,
                  )}
                />
                <TextInput
                  label={m.filler_field_nghe_nghiep()}
                  placeholder={m.filler_ph_nghe_nghiep()}
                  value={draft.giaDinh[person].ngheNghiep}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'ngheNghiep',
                      event.currentTarget.value,
                    )
                  }
                  required
                  error={mapRequiredError(
                    fieldErrors.giaDinh?.[person]?.ngheNghiep,
                  )}
                />
                <TextInput
                  label={m.filler_field_noi_o()}
                  placeholder={m.filler_ph_noi_o()}
                  value={draft.giaDinh[person].noiO}
                  onChange={(event) =>
                    updateFamilyPerson(
                      person,
                      'noiO',
                      event.currentTarget.value,
                    )
                  }
                  required
                  error={mapRequiredError(
                    fieldErrors.giaDinh?.[person]?.noiO,
                  )}
                />
              </SimpleGrid>
            </Fieldset>
          ))}
          <RepeatableFieldset
            label={m.filler_field_anh_chi_em()}
            description={m.filler_desc_anh_chi_em()}
            addLabel={m.filler_add_row()}
            onAdd={addAnhChiEmRow}
            disabled={disabled}
          >
            {draft.giaDinh.anhChiEm.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_field_anh_chi_em()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label={m.filler_field_quan_he()}
                      placeholder={m.filler_ph_quan_he()}
                      value={row.quanHe}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          quanHe: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_ho_ten()}
                      placeholder={m.filler_ph_ho_ten()}
                      value={row.hoTen}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          hoTen: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_nam_sinh()}
                      placeholder={m.filler_ph_nam_sinh()}
                      value={row.namSinh}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          namSinh: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_nghe_nghiep()}
                      placeholder={m.filler_ph_nghe_nghiep()}
                      value={row.ngheNghiep}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          ngheNghiep: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_noi_o()}
                      placeholder={m.filler_ph_noi_o()}
                      value={row.noiO}
                      onChange={(event) =>
                        updateAnhChiEmRow(index, {
                          ...row,
                          noiO: event.currentTarget.value,
                        })
                      }
                    />
                  </SimpleGrid>
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    onClick={() => removeAnhChiEmRow(index)}
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_nguyen_vong()}>
          <Textarea
            label={m.filler_field_nguyen_vong()}
            placeholder={m.filler_ph_nguyen_vong()}
            value={draft.nguyenVong}
            onChange={(event) =>
              updateDraft('nguyenVong', event.currentTarget.value)
            }
            disabled={disabled}
            minRows={4}
          />
        </FormSection>

        <FormSection title={m.filler_section_giay_to()}>
          <MemberDocumentsField
            memberId={memberId}
            cccd={cccd}
            inviteToken={inviteToken}
            getIdToken={getIdToken}
            documents={documents}
            onDocumentsChange={setDocuments}
            pendingFiles={pendingDocuments}
            onPendingFilesChange={setPendingDocuments}
            disabled={disabled}
            onUploadError={onUploadError}
            error={mapRequiredError(fieldErrors.cccdDocument)}
          />
        </FormSection>
      </>
    ),
    [
      draft.khoaTu,
      draft.giaDinh,
      draft.nguyenVong,
      disabled,
      fieldErrors.giaDinh,
      fieldErrors.cccdDocument,
      memberId,
      cccd,
      inviteToken,
      getIdToken,
      documents,
      pendingDocuments,
      onUploadError,
    ],
  )


  return (
    <Stack gap="xl" maw={760}>
      <MemberPortraitField
        memberId={memberId}
        cccd={cccd}
        inviteToken={inviteToken}
        getIdToken={getIdToken}
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
      {identitySection}
      {contactSection}
      {restSections}
      {tailSections}
    </Stack>
  )
}
