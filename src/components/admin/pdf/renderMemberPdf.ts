import { pdf } from '@react-pdf/renderer'
import { MemberPdfDocument, type MemberPdfRenderInput } from './MemberPdfDocument'
import { registerMemberPdfFonts } from './memberPdfFonts'

export type { MemberPdfRenderInput }

export async function renderMembersPdfBlob(
  members: MemberPdfRenderInput[],
): Promise<Blob> {
  registerMemberPdfFonts()
  return pdf(MemberPdfDocument({ members })).toBlob()
}
