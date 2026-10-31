import type { RetreatRegistration } from '#/domain/retreatRegistration'
import type { AdminListPage } from '#/repositories/adminListTypes'
import { d1RetreatRegistrationRepo } from '#/repositories/d1/retreatRegistrationRepo'

export type RegistrationReviewPatch = {
  status: 'approved' | 'rejected'
  approvedBy: string
  approvedAt: string
  rejectionReason: string | null
  updatedAt: string
}

export type RetreatRegistrationStore = {
  create(reg: RetreatRegistration): Promise<void>
  getById(id: string): Promise<RetreatRegistration | null>
  listByRetreat(input: {
    retreatId: string
    limit?: number
    cursor?: string
  }): Promise<AdminListPage<RetreatRegistration>>
  updateReview(ids: string[], patch: RegistrationReviewPatch): Promise<void>
}

export const retreatRegistrationRepo: RetreatRegistrationStore = d1RetreatRegistrationRepo
