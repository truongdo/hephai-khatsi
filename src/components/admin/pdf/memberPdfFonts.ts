import { Font } from '@react-pdf/renderer'
import latin400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff?url'
import latin700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff?url'
import latinExt400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-400-normal.woff?url'
import latinExt700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-700-normal.woff?url'
import vietnamese400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff?url'
import vietnamese700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff?url'

/**
 * Fontsource splits Be Vietnam Pro into unicode-range subsets: ASCII lives in `latin`,
 * ă/đ/ơ/ư in `latin-ext` and the toned letters (ạ, ế, ữ…) in `vietnamese`. react-pdf
 * cannot merge subsets into one family, so each is its own family and the PDF uses
 * this stack, which react-pdf falls back through per glyph.
 */
const SUBSETS = [
  { family: 'BeVietnamPro-Latin', regular: latin400, bold: latin700 },
  { family: 'BeVietnamPro-LatinExt', regular: latinExt400, bold: latinExt700 },
  { family: 'BeVietnamPro-Vietnamese', regular: vietnamese400, bold: vietnamese700 },
]

export const MEMBER_PDF_FONT_FAMILY = SUBSETS.map((subset) => subset.family)

let registered = false

export function registerMemberPdfFonts(): void {
  if (registered) return
  for (const subset of SUBSETS) {
    Font.register({
      family: subset.family,
      fonts: [
        { src: subset.regular, fontWeight: 400 },
        { src: subset.bold, fontWeight: 700 },
      ],
    })
  }
  registered = true
}
