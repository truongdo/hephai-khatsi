import {
  Button,
  Checkbox,
  Fieldset,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import {
  memo,
  useCallback,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { VietnamAddressFields } from '#/components/address/VietnamAddressFields'
import type { AddressDraft } from '#/domain/address'
import { m } from '#/paraglide/messages'
import {
  DAC_DIEM_OPTIONS,
  HANG_MUC_XAY_DUNG_OPTIONS,
} from './fillerFormOptions'
import { FormSection } from './FormSection'
import { RepeatableFieldset } from './RepeatableFieldset'
import type { TempleDraft, NumericValue } from './templeDraft'

type SetDraft = Dispatch<SetStateAction<TempleDraft>>

type AddressFieldErrors = { city?: string; ward?: string }

const DAC_DIEM_CHECKBOXES = DAC_DIEM_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label(),
}))

const HANG_MUC_CHECKBOXES = HANG_MUC_XAY_DUNG_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label(),
}))

const EMPTY_TRU_TRI_TIEN_NHIEM = { phapDanh: '', thoiGian: '', ghiChu: '' }
const EMPTY_BAN_QUAN_TRI = { ten: '', vaiTro: '' }
const EMPTY_HOAT_DONG = { ten: '', thoiGian: '', ghiChu: '' }
const EMPTY_TRUNG_TU = { moTa: '', ghiChu: '' }

function numberInputValue(value: string | number): NumericValue {
  return typeof value === 'number' ? value : ''
}

export const TempleIdentitySection = memo(function TempleIdentitySection({
  danhHieu,
  nguoiKhaiSon,
  namThanhLap,
  tinChuHienCung,
  dacDiem,
  setDraft,
  disabled,
}: {
  danhHieu: string
  nguoiKhaiSon: string
  namThanhLap: string
  tinChuHienCung: string
  dacDiem: string[]
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_identity()}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label={m.filler_field_danh_hieu()}
          placeholder={m.filler_ph_danh_hieu()}
          value={danhHieu}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              danhHieu: value,
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_nguoi_khai_son()}
          placeholder={m.filler_ph_nguoi_khai_son()}
          value={nguoiKhaiSon}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              nguoiKhaiSon: value,
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_nam_thanh_lap()}
          placeholder={m.filler_ph_year()}
          value={namThanhLap}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              namThanhLap: value,
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_tin_chu()}
          placeholder={m.filler_ph_tin_chu()}
          value={tinChuHienCung}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              tinChuHienCung: value,
            }))
          }}
          disabled={disabled}
        />
      </SimpleGrid>
      <Checkbox.Group
        label={m.filler_field_dac_diem()}
        value={dacDiem}
        onChange={(value) =>
          setDraft((current) => ({ ...current, dacDiem: value }))
        }
      >
        <Group mt="xs">
          {DAC_DIEM_CHECKBOXES.map((option) => (
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
  )
})

export const TempleAddressSection = memo(function TempleAddressSection({
  diaChiCu,
  diaChiMoi,
  setDraft,
  errors,
  disabled,
}: {
  diaChiCu: AddressDraft
  diaChiMoi: AddressDraft
  setDraft: SetDraft
  errors: {
    diaChiCu?: AddressFieldErrors
    diaChiMoi?: AddressFieldErrors
  }
  disabled: boolean
}) {
  const onDiaChiCu = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, diaChiCu: value })),
    [setDraft],
  )
  const onDiaChiMoi = useCallback(
    (value: AddressDraft) =>
      setDraft((current) => ({ ...current, diaChiMoi: value })),
    [setDraft],
  )

  return (
    <FormSection title={m.filler_section_temple_address()}>
      <Stack gap="lg">
        <Stack gap="xs">
          <Text fw={600}>{m.filler_field_dia_chi_cu()}</Text>
          <VietnamAddressFields
            label={m.filler_field_dia_chi_cu()}
            value={diaChiCu}
            onChange={onDiaChiCu}
            disabled={disabled}
            errors={errors.diaChiCu}
          />
        </Stack>
        <Stack gap="xs">
          <Text fw={600}>{m.filler_field_dia_chi_moi()}</Text>
          <VietnamAddressFields
            label={m.filler_field_dia_chi_moi()}
            value={diaChiMoi}
            onChange={onDiaChiMoi}
            disabled={disabled}
            errors={errors.diaChiMoi}
          />
        </Stack>
      </Stack>
    </FormSection>
  )
})

export const TempleTruTriSection = memo(function TempleTruTriSection({
  truTriHienNay,
  truTriTienNhiem,
  setDraft,
  disabled,
}: {
  truTriHienNay: TempleDraft['truTriHienNay']
  truTriTienNhiem: TempleDraft['truTriTienNhiem']
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_tru_tri()}>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <TextInput
          label={m.filler_field_tru_tri_phap_danh()}
          placeholder={m.filler_ph_phap_danh()}
          value={truTriHienNay.phapDanh}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              truTriHienNay: {
                ...current.truTriHienNay,
                phapDanh: value,
              },
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_tru_tri_phone()}
          placeholder={m.filler_ph_phone()}
          value={truTriHienNay.dienThoai}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              truTriHienNay: {
                ...current.truTriHienNay,
                dienThoai: value,
              },
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_tru_tri_email()}
          placeholder={m.filler_ph_email()}
          value={truTriHienNay.email}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              truTriHienNay: {
                ...current.truTriHienNay,
                email: value,
              },
            }))
          }}
          disabled={disabled}
        />
      </SimpleGrid>
      <RepeatableFieldset
        label={m.filler_field_tru_tri_tien_nhiem()}
        addLabel={m.filler_add_row()}
        onAdd={() =>
          setDraft((current) => ({
            ...current,
            truTriTienNhiem: [
              ...current.truTriTienNhiem,
              EMPTY_TRU_TRI_TIEN_NHIEM,
            ],
          }))
        }
        disabled={disabled}
      >
        {truTriTienNhiem.map((row, index) => (
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
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      truTriTienNhiem: current.truTriTienNhiem.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                phapDanh: value,
                              }
                            : item,
                      ),
                    }))
                  }}
                />
                <TextInput
                  label={m.filler_field_thoi_gian()}
                  placeholder={m.filler_ph_thoi_gian()}
                  value={row.thoiGian}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      truTriTienNhiem: current.truTriTienNhiem.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                thoiGian: value,
                              }
                            : item,
                      ),
                    }))
                  }}
                />
                <TextInput
                  label={m.filler_field_ghi_chu()}
                  placeholder={m.filler_ph_ghi_chu()}
                  value={row.ghiChu}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      truTriTienNhiem: current.truTriTienNhiem.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, ghiChu: value }
                            : item,
                      ),
                    }))
                  }}
                />
              </SimpleGrid>
              <Button
                type="button"
                variant="subtle"
                color="red"
                onClick={() =>
                  setDraft((current) => {
                    const nextRows = current.truTriTienNhiem.filter(
                      (_, itemIndex) => itemIndex !== index,
                    )
                    return {
                      ...current,
                      truTriTienNhiem:
                        nextRows.length > 0
                          ? nextRows
                          : [EMPTY_TRU_TRI_TIEN_NHIEM],
                    }
                  })
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
  )
})

export const TempleBanQuanTriSection = memo(function TempleBanQuanTriSection({
  banQuanTri,
  setDraft,
  disabled,
}: {
  banQuanTri: TempleDraft['banQuanTri']
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_ban_qt()}>
      <RepeatableFieldset
        label={m.filler_section_temple_ban_qt()}
        addLabel={m.filler_add_row()}
        onAdd={() =>
          setDraft((current) => ({
            ...current,
            banQuanTri: [...current.banQuanTri, EMPTY_BAN_QUAN_TRI],
          }))
        }
        disabled={disabled}
      >
        {banQuanTri.map((row, index) => (
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
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      banQuanTri: current.banQuanTri.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, ten: value }
                          : item,
                      ),
                    }))
                  }}
                />
                <TextInput
                  label={m.filler_field_ban_qt_vai_tro()}
                  placeholder={m.filler_ph_ban_qt_vai_tro()}
                  value={row.vaiTro}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      banQuanTri: current.banQuanTri.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, vaiTro: value }
                          : item,
                      ),
                    }))
                  }}
                />
              </SimpleGrid>
              <Button
                type="button"
                variant="subtle"
                color="red"
                onClick={() =>
                  setDraft((current) => {
                    const nextRows = current.banQuanTri.filter(
                      (_, itemIndex) => itemIndex !== index,
                    )
                    return {
                      ...current,
                      banQuanTri:
                        nextRows.length > 0 ? nextRows : [EMPTY_BAN_QUAN_TRI],
                    }
                  })
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
  )
})

export const TempleTangSoSection = memo(function TempleTangSoSection({
  tangSoHienTru,
  soPhatTuQuyY,
  soPhatTuThuongXuyen,
  setDraft,
  disabled,
}: {
  tangSoHienTru: TempleDraft['tangSoHienTru']
  soPhatTuQuyY: NumericValue
  soPhatTuThuongXuyen: NumericValue
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_tang_so()}>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <NumberInput
          label={m.filler_field_ty_kheo()}
          placeholder={m.filler_ph_number()}
          value={tangSoHienTru.tyKheo}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              tangSoHienTru: {
                ...current.tangSoHienTru,
                tyKheo: numberInputValue(value),
              },
            }))
          }
          disabled={disabled}
          min={0}
        />
        <NumberInput
          label={m.filler_field_ty_kheo_ni()}
          placeholder={m.filler_ph_number()}
          value={tangSoHienTru.tyKheoNi}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              tangSoHienTru: {
                ...current.tangSoHienTru,
                tyKheoNi: numberInputValue(value),
              },
            }))
          }
          disabled={disabled}
          min={0}
        />
        <NumberInput
          label={m.filler_field_sa_di()}
          placeholder={m.filler_ph_number()}
          value={tangSoHienTru.saDi}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              tangSoHienTru: {
                ...current.tangSoHienTru,
                saDi: numberInputValue(value),
              },
            }))
          }
          disabled={disabled}
          min={0}
        />
        <NumberInput
          label={m.filler_field_tap_su()}
          placeholder={m.filler_ph_number()}
          value={tangSoHienTru.tapSu}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              tangSoHienTru: {
                ...current.tangSoHienTru,
                tapSu: numberInputValue(value),
              },
            }))
          }
          disabled={disabled}
          min={0}
        />
        <NumberInput
          label={m.filler_field_so_pt_quy_y()}
          placeholder={m.filler_ph_number()}
          value={soPhatTuQuyY}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              soPhatTuQuyY: numberInputValue(value),
            }))
          }
          disabled={disabled}
          min={0}
        />
        <NumberInput
          label={m.filler_field_so_pt_thuong_xuyen()}
          placeholder={m.filler_ph_number()}
          value={soPhatTuThuongXuyen}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              soPhatTuThuongXuyen: numberInputValue(value),
            }))
          }
          disabled={disabled}
          min={0}
        />
      </SimpleGrid>
    </FormSection>
  )
})

export const TempleHoatDongSection = memo(function TempleHoatDongSection({
  hoatDongPhatSu,
  setDraft,
  disabled,
}: {
  hoatDongPhatSu: TempleDraft['hoatDongPhatSu']
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection
      title={m.filler_section_temple_hoat_dong()}
      helper={m.filler_section_temple_hoat_dong_description()}
    >
      <RepeatableFieldset
        label={m.filler_section_temple_hoat_dong()}
        addLabel={m.filler_add_row()}
        onAdd={() =>
          setDraft((current) => ({
            ...current,
            hoatDongPhatSu: [...current.hoatDongPhatSu, EMPTY_HOAT_DONG],
          }))
        }
        disabled={disabled}
      >
        {hoatDongPhatSu.map((row, index) => (
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
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      hoatDongPhatSu: current.hoatDongPhatSu.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, ten: value }
                            : item,
                      ),
                    }))
                  }}
                />
                <TextInput
                  label={m.filler_field_thoi_gian()}
                  placeholder={m.filler_ph_hoat_dong_thoi_gian()}
                  value={row.thoiGian}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      hoatDongPhatSu: current.hoatDongPhatSu.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                thoiGian: value,
                              }
                            : item,
                      ),
                    }))
                  }}
                />
                <TextInput
                  label={m.filler_field_ghi_chu()}
                  placeholder={m.filler_ph_ghi_chu()}
                  value={row.ghiChu}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      hoatDongPhatSu: current.hoatDongPhatSu.map(
                        (item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, ghiChu: value }
                            : item,
                      ),
                    }))
                  }}
                />
              </SimpleGrid>
              <Button
                type="button"
                variant="subtle"
                color="red"
                onClick={() =>
                  setDraft((current) => {
                    const nextRows = current.hoatDongPhatSu.filter(
                      (_, itemIndex) => itemIndex !== index,
                    )
                    return {
                      ...current,
                      hoatDongPhatSu:
                        nextRows.length > 0 ? nextRows : [EMPTY_HOAT_DONG],
                    }
                  })
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
  )
})

export const TempleQuyetDinhSection = memo(function TempleQuyetDinhSection({
  qdCongNhan,
  qdBoNhiemTruTri,
  setDraft,
  disabled,
}: {
  qdCongNhan: TempleDraft['qdCongNhan']
  qdBoNhiemTruTri: TempleDraft['qdBoNhiemTruTri']
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_quyet_dinh()}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput
          label={m.filler_field_qd_cong_nhan_so()}
          placeholder={m.filler_ph_qd_so()}
          value={qdCongNhan.so}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              qdCongNhan: {
                ...current.qdCongNhan,
                so: value,
              },
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_qd_cong_nhan_ngay()}
          placeholder={m.filler_ph_date()}
          value={qdCongNhan.ngay}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              qdCongNhan: {
                ...current.qdCongNhan,
                ngay: value,
              },
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_qd_bo_nhiem_so()}
          placeholder={m.filler_ph_qd_so()}
          value={qdBoNhiemTruTri.so}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              qdBoNhiemTruTri: {
                ...current.qdBoNhiemTruTri,
                so: value,
              },
            }))
          }}
          disabled={disabled}
        />
        <TextInput
          label={m.filler_field_qd_bo_nhiem_ngay()}
          placeholder={m.filler_ph_date()}
          value={qdBoNhiemTruTri.ngay}
          onChange={(event) => {
            const value = event.currentTarget.value
            setDraft((current) => ({
              ...current,
              qdBoNhiemTruTri: {
                ...current.qdBoNhiemTruTri,
                ngay: value,
              },
            }))
          }}
          disabled={disabled}
        />
      </SimpleGrid>
    </FormSection>
  )
})

export const TempleXayDungSection = memo(function TempleXayDungSection({
  moHinhKienTruc,
  hangMucXayDung,
  trungTu,
  setDraft,
  disabled,
}: {
  moHinhKienTruc: string
  hangMucXayDung: string[]
  trungTu: TempleDraft['trungTu']
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_xay_dung()}>
      <TextInput
        label={m.filler_field_mo_hinh_kien_truc()}
        placeholder={m.filler_ph_mo_hinh()}
        value={moHinhKienTruc}
        onChange={(event) => {
          const value = event.currentTarget.value
          setDraft((current) => ({
            ...current,
            moHinhKienTruc: value,
          }))
        }}
        disabled={disabled}
      />
      <Checkbox.Group
        label={m.filler_field_hang_muc_xd()}
        value={hangMucXayDung}
        onChange={(value) =>
          setDraft((current) => ({ ...current, hangMucXayDung: value }))
        }
      >
        <Group mt="xs">
          {HANG_MUC_CHECKBOXES.map((option) => (
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
        onAdd={() =>
          setDraft((current) => ({
            ...current,
            trungTu: [...current.trungTu, EMPTY_TRUNG_TU],
          }))
        }
        disabled={disabled}
      >
        {trungTu.map((row, index) => (
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
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      trungTu: current.trungTu.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, moTa: value }
                          : item,
                      ),
                    }))
                  }}
                />
                <TextInput
                  label={m.filler_field_ghi_chu()}
                  placeholder={m.filler_ph_ghi_chu()}
                  value={row.ghiChu}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setDraft((current) => ({
                      ...current,
                      trungTu: current.trungTu.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, ghiChu: value }
                          : item,
                      ),
                    }))
                  }}
                />
              </SimpleGrid>
              <Button
                type="button"
                variant="subtle"
                color="red"
                onClick={() =>
                  setDraft((current) => {
                    const nextRows = current.trungTu.filter(
                      (_, itemIndex) => itemIndex !== index,
                    )
                    return {
                      ...current,
                      trungTu:
                        nextRows.length > 0 ? nextRows : [EMPTY_TRUNG_TU],
                    }
                  })
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
  )
})

export const TempleDatSection = memo(function TempleDatSection({
  quyenSuDungDat,
  setDraft,
  disabled,
}: {
  quyenSuDungDat: TempleDraft['quyenSuDungDat']
  setDraft: SetDraft
  disabled: boolean
}) {
  return (
    <FormSection title={m.filler_section_temple_dat()}>
      <Fieldset legend={m.filler_section_temple_dat()} disabled={disabled}>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput
            label={m.filler_field_dat_so_giay()}
            placeholder={m.filler_ph_dat_so_giay()}
            value={quyenSuDungDat.soGiay}
            onChange={(event) => {
              const value = event.currentTarget.value
              setDraft((current) => ({
                ...current,
                quyenSuDungDat: {
                  ...current.quyenSuDungDat,
                  soGiay: value,
                },
              }))
            }}
          />
          <TextInput
            label={m.filler_field_dat_ngay_cap()}
            placeholder={m.filler_ph_date()}
            value={quyenSuDungDat.ngayCap}
            onChange={(event) => {
              const value = event.currentTarget.value
              setDraft((current) => ({
                ...current,
                quyenSuDungDat: {
                  ...current.quyenSuDungDat,
                  ngayCap: value,
                },
              }))
            }}
          />
          <NumberInput
            label={m.filler_field_dat_kv()}
            placeholder={m.filler_ph_number()}
            value={quyenSuDungDat.dienTichKhuonVienM2}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                quyenSuDungDat: {
                  ...current.quyenSuDungDat,
                  dienTichKhuonVienM2: numberInputValue(value),
                },
              }))
            }
            min={0}
          />
          <NumberInput
            label={m.filler_field_dat_xd()}
            placeholder={m.filler_ph_number()}
            value={quyenSuDungDat.dienTichXayDungM2}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                quyenSuDungDat: {
                  ...current.quyenSuDungDat,
                  dienTichXayDungM2: numberInputValue(value),
                },
              }))
            }
            min={0}
          />
          <TextInput
            label={m.filler_field_dat_canh_tac_so()}
            placeholder={m.filler_ph_dat_so_giay()}
            value={quyenSuDungDat.soGiayDatCanhTac}
            onChange={(event) => {
              const value = event.currentTarget.value
              setDraft((current) => ({
                ...current,
                quyenSuDungDat: {
                  ...current.quyenSuDungDat,
                  soGiayDatCanhTac: value,
                },
              }))
            }}
          />
          <NumberInput
            label={m.filler_field_dat_canh_tac_dt()}
            placeholder={m.filler_ph_number()}
            value={quyenSuDungDat.dienTichDatCanhTacM2}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                quyenSuDungDat: {
                  ...current.quyenSuDungDat,
                  dienTichDatCanhTacM2: numberInputValue(value),
                },
              }))
            }
            min={0}
          />
        </SimpleGrid>
      </Fieldset>
    </FormSection>
  )
})
