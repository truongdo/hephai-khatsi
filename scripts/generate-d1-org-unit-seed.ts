import { writeFileSync } from 'node:fs'
import { ORG_UNIT_SEED } from '../src/domain/orgUnitSeed'
import { orgUnitSeedSql } from '../src/worker/dataApi/rows/orgUnit'

// Rewrites the D1 org unit seed migration after src/domain/orgUnitSeed.ts
// changes. An applied migration never runs again, so a change to an already
// deployed seed needs a new migration instead.
const path = new URL('../migrations/0002_seed_org_units.sql', import.meta.url)
writeFileSync(path, orgUnitSeedSql(ORG_UNIT_SEED))
console.log(`Wrote ${path.pathname}`)
