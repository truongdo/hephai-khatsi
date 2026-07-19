import { upsertAllOrgUnits } from '../src/repositories/orgUnitRepo'

await upsertAllOrgUnits()
console.log('Seeded org units')
