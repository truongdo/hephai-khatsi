import { Font } from '@react-pdf/renderer'
import be400 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-400-normal.woff?url'
import be700 from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-700-normal.woff?url'

let registered = false

export function registerMemberPdfFonts(): void {
  if (registered) return
  Font.register({
    family: 'BeVietnamPro',
    fonts: [
      { src: be400, fontWeight: 400 },
      { src: be700, fontWeight: 700 },
    ],
  })
  registered = true
}
