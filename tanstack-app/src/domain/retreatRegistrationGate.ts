import type { QuyenDangKy, RetreatStatus } from './retreat'

export type RetreatSelfRegistrationGateCode = 'closed' | 'window' | 'quyen'

export function getRetreatSelfRegistrationGate(
  retreat: {
    status: RetreatStatus
    dangKyMoTu: string
    dangKyDongLuc: string
    quyenDangKy: QuyenDangKy
  },
  nowIso: string = new Date().toISOString(),
): RetreatSelfRegistrationGateCode | null {
  if (retreat.status !== 'open') return 'closed'
  if (nowIso < retreat.dangKyMoTu || nowIso > retreat.dangKyDongLuc) return 'window'
  if (retreat.quyenDangKy === 'proxy_only') return 'quyen'
  return null
}
