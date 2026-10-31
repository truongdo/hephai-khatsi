import { ORG_UNIT_SEED } from '#/domain/orgUnitSeed'
import type { ExportedDoc, ExportManifest, FirestoreExport } from '../import/exportFormat'
import {
  auditLog,
  fillerInvite,
  fullMember,
  fullTemple,
  minimalMember,
  minimalTemple,
  pendingSelfRegistration,
  rejectedProxyRegistration,
  retreat,
  retreatInvite,
} from './fixtures'

function exported({ id, ...data }: { id: string }): ExportedDoc {
  return { id, data }
}

/** A Firestore export of the row-mapper fixtures, as the export script writes it. */
export function fixtureExport(): FirestoreExport {
  return {
    orgUnits: ORG_UNIT_SEED.map(exported),
    invites: [fillerInvite, retreatInvite].map(exported),
    members: [minimalMember, fullMember].map(exported),
    temples: [minimalTemple, fullTemple].map(exported),
    retreats: [retreat].map(exported),
    retreatRegistrations: [pendingSelfRegistration, rejectedProxyRegistration].map(exported),
    auditLogs: [
      { ...exported(auditLog), parentType: 'members', parentId: fullMember.id },
      { ...exported(auditLog), parentType: 'temples', parentId: fullTemple.id },
    ],
  }
}

/** The manifest Firestore's counts would give for `fixtureExport()`. */
export function fixtureManifest(): ExportManifest {
  return {
    exportedAt: '2026-10-31T00:00:00.000Z',
    projectId: 'test',
    counts: {
      orgUnits: ORG_UNIT_SEED.length,
      invites: 2,
      members: 2,
      temples: 2,
      retreats: 1,
      retreatRegistrations: 2,
      auditLogs: 2,
    },
    memberCounts: [
      { orgUnitId: 'gd-i', sanghaType: 'tang', count: 1 },
      { orgUnitId: 'ni-gd-i', sanghaType: 'ni', count: 1 },
      { orgUnitId: 'gd-ii', sanghaType: 'tang', count: 0 },
    ],
    templeCounts: [
      { orgUnitId: 'gd-i', count: 1 },
      { orgUnitId: 'gd-ii', count: 1 },
    ],
  }
}
