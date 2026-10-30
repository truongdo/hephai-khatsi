import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(__dirname, '..')
const sourcePath = path.join(appRoot, 'city_wards.json')
const outDir = path.join(appRoot, 'src/data/vietnam-locations')
const wardsDir = path.join(outDir, 'wards')

type SourceCity = {
  code: string
  name: string
  slug: string
  type: string
  isCentral?: boolean
  fullName: string
  wards: unknown[]
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceCity[]

const cities = source.map(
  ({ code, name, slug, type, isCentral, fullName }) => ({
    code,
    name,
    slug,
    type,
    ...(isCentral === undefined ? {} : { isCentral }),
    fullName,
  }),
)

mkdirSync(wardsDir, { recursive: true })
writeFileSync(
  path.join(outDir, 'cities.json'),
  `${JSON.stringify(cities, null, 2)}\n`,
)

for (const city of source) {
  writeFileSync(
    path.join(wardsDir, `${city.code}.json`),
    `${JSON.stringify(city.wards, null, 2)}\n`,
  )
}

console.log(
  `Wrote ${cities.length} cities and ${source.length} ward files to ${outDir}`,
)
