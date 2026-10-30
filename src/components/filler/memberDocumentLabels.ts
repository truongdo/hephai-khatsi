import { m } from '#/paraglide/messages'
import type { DocumentTypeId } from '#/domain/memberDocumentTypes'

const LABELS: Record<DocumentTypeId, () => string> = {
  cccd: () => m.filler_doc_type_cccd(),
  chung_nhan_tang_ni: () => m.filler_doc_type_chung_nhan_tang_ni(),
  diep_sa_di: () => m.filler_doc_type_diep_sa_di(),
  diep_thuc_xoa: () => m.filler_doc_type_diep_thuc_xoa(),
  diep_ty_kheo: () => m.filler_doc_type_diep_ty_kheo(),
  qd_tru_tri: () => m.filler_doc_type_qd_tru_tri(),
  qd_giao_pham: () => m.filler_doc_type_qd_giao_pham(),
  qd_chuc_vu_gh: () => m.filler_doc_type_qd_chuc_vu_gh(),
}

export function documentTypeLabel(id: DocumentTypeId): string {
  return LABELS[id]()
}
