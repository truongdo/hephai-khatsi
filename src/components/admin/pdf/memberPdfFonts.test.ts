import { Font } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import {
  MEMBER_PDF_FONT_FAMILY,
  registerMemberPdfFonts,
} from '#/components/admin/pdf/memberPdfFonts'

const VIETNAMESE_LOWER =
  'aàáảãạăằắẳẵặâầấẩẫậbcdđeèéẻẽẹêềếểễệghiìíỉĩịklmnoòóỏõọôồốổỗộơờớởỡợpqrstuùúủũụưừứửữựvxyỳýỷỹỵ'
const SAMPLE_TEXT = `${VIETNAMESE_LOWER}${VIETNAMESE_LOWER.toUpperCase()}fjwz0123456789.,:;-–—/()"'“”`

async function loadFontStack(fontWeight: number) {
  return Promise.all(
    MEMBER_PDF_FONT_FAMILY.map(async (fontFamily) => {
      const source = Font.getFont({ fontFamily, fontWeight })
      await source.load()
      if (!source.data) throw new Error(`${fontFamily} did not load`)
      return source.data
    }),
  )
}

describe('member PDF fonts', () => {
  it.each([400, 700])(
    'cover every Vietnamese letter at weight %i',
    async (fontWeight) => {
      registerMemberPdfFonts()
      const fonts = await loadFontStack(fontWeight)
      const missing = [...SAMPLE_TEXT].filter((char) => {
        const codePoint = char.codePointAt(0)!
        return !fonts.some((font) => font.hasGlyphForCodePoint(codePoint))
      })
      expect(missing).toEqual([])
    },
    30_000,
  )
})
