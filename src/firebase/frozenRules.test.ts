import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { FROZEN_RULES_HEADER, freezeFirestoreRules } from './frozenRules'

function readRepoFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
}

describe('freezeFirestoreRules', () => {
  it('denies every write and keeps the read rules', () => {
    const rules = [
      "rules_version = '2';",
      'service cloud.firestore {',
      '  match /things/{id} {',
      '    allow get, list: if true;',
      '    allow create: if request.auth != null',
      "      && request.resource.data.kind in ['a;b', 'c'];",
      '    allow update, delete: if isAdmin();',
      '    allow write: if isAdmin();',
      '  }',
      '}',
    ].join('\n')

    expect(freezeFirestoreRules(rules)).toBe(
      FROZEN_RULES_HEADER +
        [
          "rules_version = '2';",
          'service cloud.firestore {',
          '  match /things/{id} {',
          '    allow get, list: if true;',
          '    allow create: if false;',
          '    allow update, delete: if false;',
          '    allow write: if false;',
          '  }',
          '}',
        ].join('\n'),
    )
  })

  it('freezes a write rule without a condition', () => {
    expect(freezeFirestoreRules('match /a/{id} { allow write; allow read; }')).toBe(
      FROZEN_RULES_HEADER + 'match /a/{id} { allow write: if false; allow read; }',
    )
  })

  it('leaves comments and identifiers containing "allow" alone', () => {
    const rules = '// allow write: if true;\nfunction allowed() { return true; }\nallow get: if allowed();'
    expect(freezeFirestoreRules(rules)).toBe(FROZEN_RULES_HEADER + rules)
  })

  it('refuses a rule that mixes reads and writes', () => {
    expect(() => freezeFirestoreRules('allow read, write: if true;')).toThrow(/mixes reads and writes/)
  })

  it('refuses an unknown operation', () => {
    expect(() => freezeFirestoreRules('allow upsert: if true;')).toThrow(/Unknown operation/)
  })

  it('matches the committed frozen rules (run pnpm rules:generate-frozen)', () => {
    expect(readRepoFile('firebase/firestore.frozen.rules')).toBe(
      freezeFirestoreRules(readRepoFile('firebase/firestore.rules')),
    )
  })

  it('leaves no write allowed in the committed frozen rules', () => {
    const frozen = readRepoFile('firebase/firestore.frozen.rules')
    const writeRules = frozen.match(/allow [a-z, ]*(create|update|delete|write)[a-z, ]*:[^;]*;/g) ?? []
    expect(writeRules.length).toBeGreaterThan(0)
    for (const rule of writeRules) expect(rule).toMatch(/: if false;$/)
  })
})
