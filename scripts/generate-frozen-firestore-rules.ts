import { readFileSync, writeFileSync } from 'node:fs'
import { freezeFirestoreRules } from '../src/firebase/frozenRules'

// Rewrites firebase/firestore.frozen.rules (the read-only rules of the D1
// cutover write freeze) after firebase/firestore.rules changes.
const source = new URL('../firebase/firestore.rules', import.meta.url)
const target = new URL('../firebase/firestore.frozen.rules', import.meta.url)
writeFileSync(target, freezeFirestoreRules(readFileSync(source, 'utf8')))
console.log(`Wrote ${target.pathname}`)
