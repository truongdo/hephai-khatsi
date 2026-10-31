import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { MemberPdfViewModel } from '#/domain/memberPdfViewModel'

export type MemberPdfRenderInput = {
  viewModel: MemberPdfViewModel
  portraitDataUrl: string | null
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'BeVietnamPro',
    fontSize: 10,
    padding: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  headerPhapDanh: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  headerLine: {
    fontSize: 11,
    marginBottom: 3,
  },
  portrait: {
    width: 85,
    height: 113,
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 2,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  fieldLabel: {
    width: '40%',
    fontSize: 9,
    color: '#444444',
  },
  fieldValue: {
    flex: 1,
    fontSize: 9,
  },
  block: {
    marginTop: 6,
    marginBottom: 4,
    paddingLeft: 8,
  },
  blockTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
  },
})

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

function MemberPage({ viewModel, portraitDataUrl }: MemberPdfRenderInput) {
  const { header, sections } = viewModel

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.headerPhapDanh}>{header.phapDanh}</Text>
          <Text style={styles.headerLine}>{header.theDanh}</Text>
          <Text style={styles.headerLine}>{header.sanghaLabel}</Text>
          <Text style={styles.headerLine}>{header.orgUnitName}</Text>
          <Text style={styles.headerLine}>{header.statusLabel}</Text>
        </View>
        {portraitDataUrl ? (
          <Image src={portraitDataUrl} style={styles.portrait} />
        ) : null}
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.fields.map((field) => (
            <FieldRow key={field.label} label={field.label} value={field.value} />
          ))}
          {section.blocks?.map((block) => (
            <View key={block.title} style={styles.block}>
              <Text style={styles.blockTitle}>{block.title}</Text>
              {block.fields.map((field) => (
                <FieldRow key={field.label} label={field.label} value={field.value} />
              ))}
            </View>
          ))}
        </View>
      ))}
    </Page>
  )
}

export function MemberPdfDocument({
  members,
}: {
  members: MemberPdfRenderInput[]
}): ReactElement<DocumentProps> {
  return (
    <Document>
      {members.map((member) => (
        <MemberPage key={member.viewModel.memberId} {...member} />
      ))}
    </Document>
  )
}
