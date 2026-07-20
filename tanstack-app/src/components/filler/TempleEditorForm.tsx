import {
  Button,
  Checkbox,
  Fieldset,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  TextInput,
} from '@mantine/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { Temple } from '#/domain/types'
import { m } from '#/paraglide/messages'
import { fillerKeys } from '#/query/fillerKeys'
import type { TempleProfilePatch } from '#/repositories/templeRepo'
import { saveTempleDraft } from '#/use-cases/saveTempleDraft'
import {
  DAC_DIEM_OPTIONS,
  HANG_MUC_XAY_DUNG_OPTIONS,
} from './fillerFormOptions'
import {
  FillerEditorShell,
  type FillerEditorStatus,
} from './FillerEditorShell'
import { FormSection } from './FormSection'
import { RepeatableFieldset } from './RepeatableFieldset'

export type TempleEditorFormProps = {
  title: string
  token: string
  orgUnitId: string
  templeId?: string
  initial: Partial<Temple> & { seedPhone?: string }
  status: FillerEditorStatus
  onCreated: (templeId: string) => void
}

type NumericValue = number | ''

type TempleDraft = {
  danhHieu: string
  dacDiem: string[]
  nguoiKhaiSon: string
  namThanhLap: string
  tinChuHienCung: string
  diaChiCu: string
  diaChiMoi: string
  truTriHienNay: { phapDanh: string; dienThoai: string; email: string }
  truTriTienNhiem: Array<{ phapDanh: string; thoiGian: string; ghiChu: string }>
  banQuanTri: Array<{ ten: string; vaiTro: string }>
  tangSoHienTru: {
    tyKheo: NumericValue
    tyKheoNi: NumericValue
    saDi: NumericValue
    tapSu: NumericValue
  }
  soPhatTuQuyY: NumericValue
  soPhatTuThuongXuyen: NumericValue
  hoatDongPhatSu: Array<{ ten: string; thoiGian: string; ghiChu: string }>
  qdCongNhan: { so: string; ngay: string }
  qdBoNhiemTruTri: { so: string; ngay: string }
  moHinhKienTruc: string
  hangMucXayDung: string[]
  trungTu: Array<{ moTa: string; ghiChu: string }>
  quyenSuDungDat: {
    soGiay: string
    ngayCap: string
    dienTichKhuonVienM2: NumericValue
    dienTichXayDungM2: NumericValue
    soGiayDatCanhTac: string
    dienTichDatCanhTacM2: NumericValue
  }
}

const EMPTY_TRU_TRI_TIEN_NHIEM = { phapDanh: '', thoiGian: '', ghiChu: '' }
const EMPTY_BAN_QUAN_TRI = { ten: '', vaiTro: '' }
const EMPTY_HOAT_DONG = { ten: '', thoiGian: '', ghiChu: '' }
const EMPTY_TRUNG_TU = { moTa: '', ghiChu: '' }

function numberOrBlank(value?: number): NumericValue {
  return typeof value === 'number' ? value : ''
}

function numberOrUndefined(value: NumericValue): number | undefined {
  return typeof value === 'number' ? value : undefined
}

function textOrUndefined(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function numberInputValue(value: string | number): NumericValue {
  return typeof value === 'number' ? value : ''
}

function hasText(values: string[]): boolean {
  return values.some((value) => value.trim().length > 0)
}

function withAtLeastOne<T>(rows: T[] | undefined, emptyRow: T): T[] {
  return rows && rows.length > 0 ? rows : [emptyRow]
}

function emptyTempleDraft(initial: TempleEditorFormProps['initial']): TempleDraft {
  const seededPhone =
    initial.truTriHienNay?.dienThoai || initial.seedPhone || ''

  return {
    danhHieu: initial.danhHieu ?? '',
    dacDiem: initial.dacDiem ?? [],
    nguoiKhaiSon: initial.nguoiKhaiSon ?? '',
    namThanhLap: initial.namThanhLap ?? '',
    tinChuHienCung: initial.tinChuHienCung ?? '',
    diaChiCu: initial.diaChiCu ?? '',
    diaChiMoi: initial.diaChiMoi ?? '',
    truTriHienNay: {
      phapDanh: initial.truTriHienNay?.phapDanh ?? '',
      dienThoai: seededPhone,
      email: initial.truTriHienNay?.email ?? '',
    },
    truTriTienNhiem: withAtLeastOne(
      initial.truTriTienNhiem?.map((row) => ({
        phapDanh: row.phapDanh ?? '',
        thoiGian: row.thoiGian ?? '',
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_TRU_TRI_TIEN_NHIEM,
    ),
    banQuanTri: withAtLeastOne(
      initial.banQuanTri?.map((row) => ({
        ten: row.ten ?? '',
        vaiTro: row.vaiTro ?? '',
      })),
      EMPTY_BAN_QUAN_TRI,
    ),
    tangSoHienTru: {
      tyKheo: numberOrBlank(initial.tangSoHienTru?.tyKheo),
      tyKheoNi: numberOrBlank(initial.tangSoHienTru?.tyKheoNi),
      saDi: numberOrBlank(initial.tangSoHienTru?.saDi),
      tapSu: numberOrBlank(initial.tangSoHienTru?.tapSu),
    },
    soPhatTuQuyY: numberOrBlank(initial.soPhatTuQuyY),
    soPhatTuThuongXuyen: numberOrBlank(initial.soPhatTuThuongXuyen),
    hoatDongPhatSu: withAtLeastOne(
      initial.hoatDongPhatSu?.map((row) => ({
        ten: row.ten ?? '',
        thoiGian: row.thoiGian ?? '',
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_HOAT_DONG,
    ),
    qdCongNhan: {
      so: initial.qdCongNhan?.so ?? '',
      ngay: initial.qdCongNhan?.ngay ?? '',
    },
    qdBoNhiemTruTri: {
      so: initial.qdBoNhiemTruTri?.so ?? '',
      ngay: initial.qdBoNhiemTruTri?.ngay ?? '',
    },
    moHinhKienTruc: initial.moHinhKienTruc ?? '',
    hangMucXayDung: initial.hangMucXayDung ?? [],
    trungTu: withAtLeastOne(
      initial.trungTu?.map((row) => ({
        moTa: row.moTa ?? '',
        ghiChu: row.ghiChu ?? '',
      })),
      EMPTY_TRUNG_TU,
    ),
    quyenSuDungDat: {
      soGiay: initial.quyenSuDungDat?.soGiay ?? '',
      ngayCap: initial.quyenSuDungDat?.ngayCap ?? '',
      dienTichKhuonVienM2: numberOrBlank(
        initial.quyenSuDungDat?.dienTichKhuonVienM2,
      ),
      dienTichXayDungM2: numberOrBlank(
        initial.quyenSuDungDat?.dienTichXayDungM2,
      ),
      soGiayDatCanhTac: initial.quyenSuDungDat?.soGiayDatCanhTac ?? '',
      dienTichDatCanhTacM2: numberOrBlank(
        initial.quyenSuDungDat?.dienTichDatCanhTacM2,
      ),
    },
  }
}

function buildPatch(draft: TempleDraft): TempleProfilePatch {
  return {
    danhHieu: textOrUndefined(draft.danhHieu),
    dacDiem: draft.dacDiem,
    nguoiKhaiSon: textOrUndefined(draft.nguoiKhaiSon),
    namThanhLap: textOrUndefined(draft.namThanhLap),
    tinChuHienCung: textOrUndefined(draft.tinChuHienCung),
    diaChiCu: textOrUndefined(draft.diaChiCu),
    diaChiMoi: textOrUndefined(draft.diaChiMoi),
    truTriHienNay: {
      phapDanh: textOrUndefined(draft.truTriHienNay.phapDanh),
      dienThoai: textOrUndefined(draft.truTriHienNay.dienThoai),
      email: textOrUndefined(draft.truTriHienNay.email),
    },
    truTriTienNhiem: draft.truTriTienNhiem
      .filter((row) => hasText([row.phapDanh, row.thoiGian, row.ghiChu]))
      .map((row) => ({
        phapDanh: textOrUndefined(row.phapDanh),
        thoiGian: textOrUndefined(row.thoiGian),
        ghiChu: textOrUndefined(row.ghiChu),
      })),
    banQuanTri: draft.banQuanTri
      .filter((row) => row.ten.trim())
      .map((row) => ({
        ten: row.ten.trim(),
        vaiTro: textOrUndefined(row.vaiTro),
      })),
    tangSoHienTru: {
      tyKheo: numberOrUndefined(draft.tangSoHienTru.tyKheo),
      tyKheoNi: numberOrUndefined(draft.tangSoHienTru.tyKheoNi),
      saDi: numberOrUndefined(draft.tangSoHienTru.saDi),
      tapSu: numberOrUndefined(draft.tangSoHienTru.tapSu),
    },
    soPhatTuQuyY: numberOrUndefined(draft.soPhatTuQuyY),
    soPhatTuThuongXuyen: numberOrUndefined(draft.soPhatTuThuongXuyen),
    hoatDongPhatSu: draft.hoatDongPhatSu
      .filter((row) => hasText([row.ten, row.thoiGian, row.ghiChu]))
      .map((row) => ({
        ten: textOrUndefined(row.ten),
        thoiGian: textOrUndefined(row.thoiGian),
        ghiChu: textOrUndefined(row.ghiChu),
      })),
    qdCongNhan: {
      so: textOrUndefined(draft.qdCongNhan.so),
      ngay: textOrUndefined(draft.qdCongNhan.ngay),
    },
    qdBoNhiemTruTri: {
      so: textOrUndefined(draft.qdBoNhiemTruTri.so),
      ngay: textOrUndefined(draft.qdBoNhiemTruTri.ngay),
    },
    moHinhKienTruc: textOrUndefined(draft.moHinhKienTruc),
    hangMucXayDung: draft.hangMucXayDung,
    trungTu: draft.trungTu
      .filter((row) => hasText([row.moTa, row.ghiChu]))
      .map((row) => ({
        moTa: row.moTa.trim(),
        ghiChu: row.ghiChu.trim(),
      })),
    quyenSuDungDat: {
      soGiay: textOrUndefined(draft.quyenSuDungDat.soGiay),
      ngayCap: textOrUndefined(draft.quyenSuDungDat.ngayCap),
      dienTichKhuonVienM2: numberOrUndefined(
        draft.quyenSuDungDat.dienTichKhuonVienM2,
      ),
      dienTichXayDungM2: numberOrUndefined(
        draft.quyenSuDungDat.dienTichXayDungM2,
      ),
      soGiayDatCanhTac: textOrUndefined(
        draft.quyenSuDungDat.soGiayDatCanhTac,
      ),
      dienTichDatCanhTacM2: numberOrUndefined(
        draft.quyenSuDungDat.dienTichDatCanhTacM2,
      ),
    },
  }
}

function optionData(options: Array<{ value: string; label: () => string }>) {
  return options.map((option) => ({
    value: option.value,
    label: option.label(),
  }))
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
  const disabled = status === 'view'

  const saveMutation = useMutation({
    mutationFn: () =>
      saveTempleDraft({
        token,
        orgUnitId,
        templeId,
        patch: buildPatch(draft),
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

  const updateDraft = <K extends keyof TempleDraft>(
    key: K,
    value: TempleDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }))

  const updateNested = <K extends keyof TempleDraft, F extends keyof TempleDraft[K]>(
    key: K,
    field: F,
    value: TempleDraft[K][F],
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: { ...(current[key] as object), [field]: value },
    }))

  const updateRow = <
    K extends
      | 'truTriTienNhiem'
      | 'banQuanTri'
      | 'hoatDongPhatSu'
      | 'trungTu',
  >(
    key: K,
    index: number,
    row: TempleDraft[K][number],
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) =>
        itemIndex === index ? row : item,
      ),
    }))

  const addRow = <
    K extends
      | 'truTriTienNhiem'
      | 'banQuanTri'
      | 'hoatDongPhatSu'
      | 'trungTu',
  >(
    key: K,
    row: TempleDraft[K][number],
  ) =>
    setDraft((current) => ({
      ...current,
      [key]: [...current[key], row],
    }))

  const removeRow = <
    K extends
      | 'truTriTienNhiem'
      | 'banQuanTri'
      | 'hoatDongPhatSu'
      | 'trungTu',
  >(
    key: K,
    index: number,
    emptyRow: TempleDraft[K][number],
  ) =>
    setDraft((current) => {
      const nextRows = current[key].filter((_, itemIndex) => itemIndex !== index)
      return {
        ...current,
        [key]: nextRows.length > 0 ? nextRows : [emptyRow],
      }
    })

  return (
    <FillerEditorShell
      title={title}
      status={status}
      onSave={status === 'draft' ? () => saveMutation.mutate() : undefined}
      savePending={saveMutation.isPending}
      saveError={saveError}
      saveSuccess={saveSuccess}
    >
      <Stack gap="xl" maw={760}>
        <FormSection title={m.filler_section_temple_identity()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_danh_hieu()}
              placeholder={m.filler_ph_danh_hieu()}
              value={draft.danhHieu}
              onChange={(event) =>
                updateDraft('danhHieu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_nguoi_khai_son()}
              placeholder={m.filler_ph_nguoi_khai_son()}
              value={draft.nguoiKhaiSon}
              onChange={(event) =>
                updateDraft('nguoiKhaiSon', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_nam_thanh_lap()}
              placeholder={m.filler_ph_year()}
              value={draft.namThanhLap}
              onChange={(event) =>
                updateDraft('namThanhLap', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_tin_chu()}
              placeholder={m.filler_ph_tin_chu()}
              value={draft.tinChuHienCung}
              onChange={(event) =>
                updateDraft('tinChuHienCung', event.currentTarget.value)
              }
              disabled={disabled}
            />
          </SimpleGrid>
          <Checkbox.Group
            label={m.filler_field_dac_diem()}
            value={draft.dacDiem}
            onChange={(value) => updateDraft('dacDiem', value)}
          >
            <Group mt="xs">
              {optionData(DAC_DIEM_OPTIONS).map((option) => (
                <Checkbox
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={disabled}
                />
              ))}
            </Group>
          </Checkbox.Group>
        </FormSection>

        <FormSection title={m.filler_section_temple_address()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_dia_chi_cu()}
              placeholder={m.filler_ph_dia_chi_cu()}
              value={draft.diaChiCu}
              onChange={(event) =>
                updateDraft('diaChiCu', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_dia_chi_moi()}
              placeholder={m.filler_ph_dia_chi_moi()}
              value={draft.diaChiMoi}
              onChange={(event) =>
                updateDraft('diaChiMoi', event.currentTarget.value)
              }
              disabled={disabled}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_temple_tru_tri()}>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput
              label={m.filler_field_tru_tri_phap_danh()}
              placeholder={m.filler_ph_phap_danh()}
              value={draft.truTriHienNay.phapDanh}
              onChange={(event) =>
                updateNested(
                  'truTriHienNay',
                  'phapDanh',
                  event.currentTarget.value,
                )
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_tru_tri_phone()}
              placeholder={m.filler_ph_phone()}
              value={draft.truTriHienNay.dienThoai}
              onChange={(event) =>
                updateNested(
                  'truTriHienNay',
                  'dienThoai',
                  event.currentTarget.value,
                )
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_tru_tri_email()}
              placeholder={m.filler_ph_email()}
              value={draft.truTriHienNay.email}
              onChange={(event) =>
                updateNested(
                  'truTriHienNay',
                  'email',
                  event.currentTarget.value,
                )
              }
              disabled={disabled}
            />
          </SimpleGrid>
          <RepeatableFieldset
            label={m.filler_field_tru_tri_tien_nhiem()}
            addLabel={m.filler_add_row()}
            onAdd={() => addRow('truTriTienNhiem', EMPTY_TRU_TRI_TIEN_NHIEM)}
            disabled={disabled}
          >
            {draft.truTriTienNhiem.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_field_tru_tri_tien_nhiem()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label={m.filler_field_phap_danh()}
                      placeholder={m.filler_ph_phap_danh()}
                      value={row.phapDanh}
                      onChange={(event) =>
                        updateRow('truTriTienNhiem', index, {
                          ...row,
                          phapDanh: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_thoi_gian()}
                      placeholder={m.filler_ph_thoi_gian()}
                      value={row.thoiGian}
                      onChange={(event) =>
                        updateRow('truTriTienNhiem', index, {
                          ...row,
                          thoiGian: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_ghi_chu()}
                      placeholder={m.filler_ph_ghi_chu()}
                      value={row.ghiChu}
                      onChange={(event) =>
                        updateRow('truTriTienNhiem', index, {
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
                    onClick={() =>
                      removeRow(
                        'truTriTienNhiem',
                        index,
                        EMPTY_TRU_TRI_TIEN_NHIEM,
                      )
                    }
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_temple_ban_qt()}>
          <RepeatableFieldset
            label={m.filler_section_temple_ban_qt()}
            addLabel={m.filler_add_row()}
            onAdd={() => addRow('banQuanTri', EMPTY_BAN_QUAN_TRI)}
            disabled={disabled}
          >
            {draft.banQuanTri.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_section_temple_ban_qt()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label={m.filler_field_ban_qt_ten()}
                      placeholder={m.filler_ph_ban_qt_ten()}
                      value={row.ten}
                      onChange={(event) =>
                        updateRow('banQuanTri', index, {
                          ...row,
                          ten: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_ban_qt_vai_tro()}
                      placeholder={m.filler_ph_ban_qt_vai_tro()}
                      value={row.vaiTro}
                      onChange={(event) =>
                        updateRow('banQuanTri', index, {
                          ...row,
                          vaiTro: event.currentTarget.value,
                        })
                      }
                    />
                  </SimpleGrid>
                  <Button
                    type="button"
                    variant="subtle"
                    color="red"
                    onClick={() =>
                      removeRow('banQuanTri', index, EMPTY_BAN_QUAN_TRI)
                    }
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_temple_tang_so()}>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <NumberInput
              label={m.filler_field_ty_kheo()}
              placeholder={m.filler_ph_number()}
              value={draft.tangSoHienTru.tyKheo}
              onChange={(value) =>
                updateNested(
                  'tangSoHienTru',
                  'tyKheo',
                  numberInputValue(value),
                )
              }
              disabled={disabled}
              min={0}
            />
            <NumberInput
              label={m.filler_field_ty_kheo_ni()}
              placeholder={m.filler_ph_number()}
              value={draft.tangSoHienTru.tyKheoNi}
              onChange={(value) =>
                updateNested(
                  'tangSoHienTru',
                  'tyKheoNi',
                  numberInputValue(value),
                )
              }
              disabled={disabled}
              min={0}
            />
            <NumberInput
              label={m.filler_field_sa_di()}
              placeholder={m.filler_ph_number()}
              value={draft.tangSoHienTru.saDi}
              onChange={(value) =>
                updateNested('tangSoHienTru', 'saDi', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
            <NumberInput
              label={m.filler_field_tap_su()}
              placeholder={m.filler_ph_number()}
              value={draft.tangSoHienTru.tapSu}
              onChange={(value) =>
                updateNested('tangSoHienTru', 'tapSu', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
            <NumberInput
              label={m.filler_field_so_pt_quy_y()}
              placeholder={m.filler_ph_number()}
              value={draft.soPhatTuQuyY}
              onChange={(value) =>
                updateDraft('soPhatTuQuyY', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
            <NumberInput
              label={m.filler_field_so_pt_thuong_xuyen()}
              placeholder={m.filler_ph_number()}
              value={draft.soPhatTuThuongXuyen}
              onChange={(value) =>
                updateDraft('soPhatTuThuongXuyen', numberInputValue(value))
              }
              disabled={disabled}
              min={0}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection
          title={m.filler_section_temple_hoat_dong()}
          helper={m.filler_section_temple_hoat_dong_description()}
        >
          <RepeatableFieldset
            label={m.filler_section_temple_hoat_dong()}
            addLabel={m.filler_add_row()}
            onAdd={() => addRow('hoatDongPhatSu', EMPTY_HOAT_DONG)}
            disabled={disabled}
          >
            {draft.hoatDongPhatSu.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_section_temple_hoat_dong()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <TextInput
                      label={m.filler_field_hoat_dong_ten()}
                      placeholder={m.filler_ph_hoat_dong_ten()}
                      value={row.ten}
                      onChange={(event) =>
                        updateRow('hoatDongPhatSu', index, {
                          ...row,
                          ten: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_thoi_gian()}
                      placeholder={m.filler_ph_hoat_dong_thoi_gian()}
                      value={row.thoiGian}
                      onChange={(event) =>
                        updateRow('hoatDongPhatSu', index, {
                          ...row,
                          thoiGian: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_ghi_chu()}
                      placeholder={m.filler_ph_ghi_chu()}
                      value={row.ghiChu}
                      onChange={(event) =>
                        updateRow('hoatDongPhatSu', index, {
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
                    onClick={() =>
                      removeRow('hoatDongPhatSu', index, EMPTY_HOAT_DONG)
                    }
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_temple_quyet_dinh()}>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={m.filler_field_qd_cong_nhan_so()}
              placeholder={m.filler_ph_qd_so()}
              value={draft.qdCongNhan.so}
              onChange={(event) =>
                updateNested('qdCongNhan', 'so', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_qd_cong_nhan_ngay()}
              placeholder={m.filler_ph_date()}
              value={draft.qdCongNhan.ngay}
              onChange={(event) =>
                updateNested('qdCongNhan', 'ngay', event.currentTarget.value)
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_qd_bo_nhiem_so()}
              placeholder={m.filler_ph_qd_so()}
              value={draft.qdBoNhiemTruTri.so}
              onChange={(event) =>
                updateNested(
                  'qdBoNhiemTruTri',
                  'so',
                  event.currentTarget.value,
                )
              }
              disabled={disabled}
            />
            <TextInput
              label={m.filler_field_qd_bo_nhiem_ngay()}
              placeholder={m.filler_ph_date()}
              value={draft.qdBoNhiemTruTri.ngay}
              onChange={(event) =>
                updateNested(
                  'qdBoNhiemTruTri',
                  'ngay',
                  event.currentTarget.value,
                )
              }
              disabled={disabled}
            />
          </SimpleGrid>
        </FormSection>

        <FormSection title={m.filler_section_temple_xay_dung()}>
          <TextInput
            label={m.filler_field_mo_hinh_kien_truc()}
            placeholder={m.filler_ph_mo_hinh()}
            value={draft.moHinhKienTruc}
            onChange={(event) =>
              updateDraft('moHinhKienTruc', event.currentTarget.value)
            }
            disabled={disabled}
          />
          <Checkbox.Group
            label={m.filler_field_hang_muc_xd()}
            value={draft.hangMucXayDung}
            onChange={(value) => updateDraft('hangMucXayDung', value)}
          >
            <Group mt="xs">
              {optionData(HANG_MUC_XAY_DUNG_OPTIONS).map((option) => (
                <Checkbox
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={disabled}
                />
              ))}
            </Group>
          </Checkbox.Group>
          <RepeatableFieldset
            label={m.filler_field_trung_tu()}
            addLabel={m.filler_add_row()}
            onAdd={() => addRow('trungTu', EMPTY_TRUNG_TU)}
            disabled={disabled}
          >
            {draft.trungTu.map((row, index) => (
              <Fieldset
                key={index}
                legend={`${m.filler_field_trung_tu()} ${index + 1}`}
                disabled={disabled}
              >
                <Stack>
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label={m.filler_field_mo_ta()}
                      placeholder={m.filler_ph_mo_ta()}
                      value={row.moTa}
                      onChange={(event) =>
                        updateRow('trungTu', index, {
                          ...row,
                          moTa: event.currentTarget.value,
                        })
                      }
                    />
                    <TextInput
                      label={m.filler_field_ghi_chu()}
                      placeholder={m.filler_ph_ghi_chu()}
                      value={row.ghiChu}
                      onChange={(event) =>
                        updateRow('trungTu', index, {
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
                    onClick={() => removeRow('trungTu', index, EMPTY_TRUNG_TU)}
                    disabled={disabled}
                  >
                    {m.filler_remove_row()}
                  </Button>
                </Stack>
              </Fieldset>
            ))}
          </RepeatableFieldset>
        </FormSection>

        <FormSection title={m.filler_section_temple_dat()}>
          <Fieldset legend={m.filler_section_temple_dat()} disabled={disabled}>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput
                label={m.filler_field_dat_so_giay()}
                placeholder={m.filler_ph_dat_so_giay()}
                value={draft.quyenSuDungDat.soGiay}
                onChange={(event) =>
                  updateNested(
                    'quyenSuDungDat',
                    'soGiay',
                    event.currentTarget.value,
                  )
                }
              />
              <TextInput
                label={m.filler_field_dat_ngay_cap()}
                placeholder={m.filler_ph_date()}
                value={draft.quyenSuDungDat.ngayCap}
                onChange={(event) =>
                  updateNested(
                    'quyenSuDungDat',
                    'ngayCap',
                    event.currentTarget.value,
                  )
                }
              />
              <NumberInput
                label={m.filler_field_dat_kv()}
                placeholder={m.filler_ph_number()}
                value={draft.quyenSuDungDat.dienTichKhuonVienM2}
                onChange={(value) =>
                  updateNested(
                    'quyenSuDungDat',
                    'dienTichKhuonVienM2',
                    numberInputValue(value),
                  )
                }
                min={0}
              />
              <NumberInput
                label={m.filler_field_dat_xd()}
                placeholder={m.filler_ph_number()}
                value={draft.quyenSuDungDat.dienTichXayDungM2}
                onChange={(value) =>
                  updateNested(
                    'quyenSuDungDat',
                    'dienTichXayDungM2',
                    numberInputValue(value),
                  )
                }
                min={0}
              />
              <TextInput
                label={m.filler_field_dat_canh_tac_so()}
                placeholder={m.filler_ph_dat_so_giay()}
                value={draft.quyenSuDungDat.soGiayDatCanhTac}
                onChange={(event) =>
                  updateNested(
                    'quyenSuDungDat',
                    'soGiayDatCanhTac',
                    event.currentTarget.value,
                  )
                }
              />
              <NumberInput
                label={m.filler_field_dat_canh_tac_dt()}
                placeholder={m.filler_ph_number()}
                value={draft.quyenSuDungDat.dienTichDatCanhTacM2}
                onChange={(value) =>
                  updateNested(
                    'quyenSuDungDat',
                    'dienTichDatCanhTacM2',
                    numberInputValue(value),
                  )
                }
                min={0}
              />
            </SimpleGrid>
          </Fieldset>
        </FormSection>

        <FormSection title={m.filler_section_temple_phones()}>
          <TextInput
            label={m.filler_field_manager_phone()}
            placeholder={m.filler_ph_phone()}
            value={extraManagerPhone}
            onChange={(event) => setExtraManagerPhone(event.currentTarget.value)}
            disabled={disabled}
          />
        </FormSection>
      </Stack>
    </FillerEditorShell>
  )
}
