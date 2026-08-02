import { downloadMembersExcel } from '#/domain/exportMembersExcel'
import type { RecordStatus, SanghaType } from '#/domain/types'
import { memberRepo, type MemberStore } from '#/repositories/memberRepo'

export type ExportMembersExcelInput = {
  sanghaType: SanghaType
  orgUnitId?: string
  status?: RecordStatus
}

export async function exportMembersExcel(
  input: ExportMembersExcelInput,
  memberStore: Pick<MemberStore, 'listAllForExport'> = memberRepo,
): Promise<void> {
  const members = await memberStore.listAllForExport({
    sanghaType: input.sanghaType,
    orgUnitId: input.orgUnitId,
    status: input.status,
  })
  downloadMembersExcel(members, input.sanghaType)
}
