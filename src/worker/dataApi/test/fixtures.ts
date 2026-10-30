import type { AuditLogEntry } from '#/domain/auditLog'
import type { Retreat } from '#/domain/retreat'
import type { RetreatRegistration } from '#/domain/retreatRegistration'
import type { Invite, Member, Temple } from '#/domain/types'

// Records shaped like the ones the Firestore repos write, for row-mapper tests.

export const minimalMember: Member = {
  id: 'gd-i_tang_123456789012',
  orgUnitId: 'gd-i',
  sanghaType: 'tang',
  status: 'draft',
  cccd: '123456789012',
  inviteId: null,
  currentTempleId: null,
  photoPath: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

export const fullMember: Member = {
  ...minimalMember,
  id: 'ni-gd-i_ni_079123456789',
  orgUnitId: 'ni-gd-i',
  sanghaType: 'ni',
  status: 'locked',
  cccd: '079123456789',
  inviteId: 'public',
  currentTempleId: 'temple-1',
  photoPath: 'members/ni-gd-i_ni_079123456789/portrait.jpg',
  theDanh: 'NGUYỄN THỊ A',
  phapDanh: 'THÍCH NỮ DIỆU HẠNH',
  phanDoan: 'Phân đoàn 1',
  ngaySinh: '1980-01-02',
  noiSinh: { cityCode: '79', cityName: 'TP Hồ Chí Minh', wardCode: '26734', wardName: 'Phường Bến Thành', line: "12 Lê Lợi 'A'" },
  nguyenQuan: 'Long An',
  cccdMeta: { ngayCap: '2021-05-01', noiCap: 'Cục CS QLHC' },
  danToc: 'Kinh',
  dienThoai: '+84 912 345 678',
  email: 'dieuhanh@example.com',
  diaChiThuongTru: 'Ấp 3, xã Tân Phú',
  gioiSaDiNi: { ngayGh: '1995-04-08', taiGh: 'Tịnh xá Ngọc Phương' },
  gioiTyKheoNi: { ngayGh: '2001-04-08', ngayHePhai: '2001-04-15', taiHePhai: 'Tịnh xá Trung Tâm' },
  giaoPhamGiaoHoi: { rank: 'ni_su', namTienPhong: 2015 },
  giaoPhamHePhai: { rank: 'ni_su', namTienPhong: 2016 },
  orgUnitName: 'Ni giới Giáo đoàn I',
  giaoPhamHePhaiRankOrder: 3,
  haLapTabRank: 'ni_su',
  haLap: 24,
  sapXepHaLap: '03|2001-04-08|2001-04-15',
  chucVuHePhai: [{ tuThangNam: '01/2010', noiDung: 'Trụ trì', diaChi: 'Tịnh xá Ngọc Phương' }],
  khoaTu: [{ ten: 'An cư', soLan: 3 }],
  giaDinh: {
    cha: { hoTen: 'Nguyễn Văn B', namSinh: '1950' },
    anhChiEm: [{ quanHe: 'Em', hoTen: 'Nguyễn Văn C' }],
  },
  tinhTrang: 'sinh_hoat',
  documents: {},
  lockedAt: '2026-07-20T01:00:00.000Z',
  lockedBy: 'filler:0912345678',
  editRequestedAt: '2026-07-21T01:00:00.000Z',
  editRequestedBy: '0912345678',
  directoryRole: 'giao_doan_admin',
  directoryAuthUid: 'uid-123',
  directoryRoleGrantedAt: '2026-07-22T00:00:00.000Z',
  directoryRoleGrantedBy: 'admin-1',
}

export const minimalTemple: Temple = {
  id: 'temple-min',
  orgUnitId: 'gd-ii',
  status: 'draft',
  managerPhones: ['0901234567'],
  inviteId: null,
  photoPath: null,
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
  lockedAt: null,
  lockedBy: null,
  editRequestedAt: null,
  editRequestedBy: null,
}

export const fullTemple: Temple = {
  ...minimalTemple,
  id: 'temple-1',
  orgUnitId: 'gd-i',
  listCityName: 'TP Hồ Chí Minh',
  orgUnitName: 'Giáo đoàn I',
  status: 'locked',
  managerPhones: ['0901234567', '0912345678'],
  inviteId: 'public',
  photoPath: 'temples/temple-1/photo.jpg',
  danhHieu: 'Tịnh xá Ngọc Phương',
  dacDiem: ['tinh_xa'],
  diaChiMoi: { cityCode: '79', cityName: 'TP Hồ Chí Minh', wardCode: '26734', wardName: 'Phường Bến Thành' },
  truTriHienNay: { phapDanh: 'Thích Minh A', dienThoai: '0912345678' },
  banQuanTri: [{ ten: 'Thích Minh B', vaiTro: 'Phó' }],
  tangSoHienTru: { tyKheo: 3, saDi: 1 },
  soPhatTuQuyY: 120,
  qdCongNhan: { trangThai: 'chinh_thuc', so: '12/QĐ', ngay: '2010-01-01' },
  quyenSuDungDat: { soGiay: 'AB 123', dienTichKhuonVienM2: 1250.5 },
  lockedAt: '2026-07-20T01:00:00.000Z',
  lockedBy: 'admin-1',
}

export const fillerInvite: Invite = {
  id: 'public',
  token: 'public',
  createdAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'admin-1',
  kind: 'filler',
  retreatId: null,
  orgUnitId: null,
  disabled: false,
}

export const retreatInvite: Invite = {
  id: 'retreat_retreat-1',
  token: 'retreat_retreat-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  createdBy: 'admin-1',
  kind: 'retreat_registration',
  retreatId: 'retreat-1',
  orgUnitId: 'gd-i',
  disabled: true,
}

export const retreat: Retreat = {
  id: 'retreat-1',
  type: 'giao_doan',
  orgUnitId: 'gd-i',
  name: 'Khóa tu hè',
  diaDiem: 'TX Trung Tâm',
  noiDung: 'Thiền',
  doiTuongThamDu: 'Tăng ni',
  thoiGianBatDau: '2026-08-01T00:00:00.000Z',
  thoiGianKetThuc: '2026-08-07T00:00:00.000Z',
  dangKyMoTu: '2026-07-01T00:00:00.000Z',
  dangKyDongLuc: '2026-07-20T00:00:00.000Z',
  extraFields: [{ key: 'size_ao', label: 'Cỡ áo', required: true }],
  quyenDangKy: 'both',
  status: 'open',
  createdBy: 'admin-1',
  createdAt: '2026-06-19T10:00:00.000Z',
  updatedAt: '2026-06-20T10:00:00.000Z',
}

export const pendingSelfRegistration: RetreatRegistration = {
  id: 'retreat-1_gd-i_tang_123456789012',
  retreatId: 'retreat-1',
  memberId: 'gd-i_tang_123456789012',
  orgUnitId: 'gd-i',
  registeredVia: 'self',
  registeredBy: null,
  extraAnswers: { size_ao: 'M' },
  status: 'pending',
  rejectionReason: null,
  approvedBy: null,
  approvedAt: null,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
}

export const rejectedProxyRegistration: RetreatRegistration = {
  ...pendingSelfRegistration,
  id: 'retreat-1_ni-gd-i_ni_079123456789',
  memberId: 'ni-gd-i_ni_079123456789',
  registeredVia: 'proxy',
  registeredBy: 'admin-2',
  extraAnswers: {},
  status: 'rejected',
  rejectionReason: 'Không đúng đối tượng',
  approvedBy: 'admin-1',
  approvedAt: '2026-07-06T00:00:00.000Z',
  updatedAt: '2026-07-06T00:00:00.000Z',
}

export const auditLog: AuditLogEntry = {
  id: 'log-1',
  action: 'updated',
  at: '2026-07-20T01:00:00.000Z',
  actorType: 'filler',
  actorId: '0912345678',
  changes: [
    { path: 'phapDanh', before: null, after: 'THÍCH NỮ DIỆU HẠNH' },
    { path: 'khoaTu.0.soLan', before: 2, after: 3 },
  ],
  summary: '2',
}
