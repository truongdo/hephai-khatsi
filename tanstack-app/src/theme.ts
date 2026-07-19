import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Ten-shade scales built around the brand's exact tokens (see styles.css) so
// Mantine's own color math (hover/light variants, ThemeIcon, Badge, etc.)
// stays anchored to the real palette instead of an auto-generated one.
const teal: MantineColorsTuple = [
  '#eef3f1',
  '#d4e2dd',
  '#b3ccc4',
  '#8fb3a8',
  '#6a9a8b',
  '#4f7d6c',
  '#2a6d61', // teal-soft
  '#1c534a', // teal-mid
  '#173f38',
  '#123832', // ink-teal
]

const saffron: MantineColorsTuple = [
  '#fbf3e6',
  '#f6e3c8', // saffron-pale
  '#efd0a0',
  '#e8b36b', // saffron-light
  '#dd9e4d',
  '#d18a37',
  '#c97a2b', // saffron
  '#a86323',
  '#874e1c',
  '#6b3d16',
]

const jade: MantineColorsTuple = [
  '#eef4f0',
  '#e2ede7', // jade-pale
  '#c3dad0',
  '#a1c4b5',
  '#7fac99',
  '#66927e',
  '#4f7d6c', // jade
  '#3f6455',
  '#304c41',
  '#22362f',
]

const clay: MantineColorsTuple = [
  '#faf1ed',
  '#f3e0da', // clay-pale
  '#e6c3b7',
  '#d7a290',
  '#c5806a',
  '#b76a4f',
  '#a8503b', // clay
  '#8a4130',
  '#6c3226',
  '#4f251c',
]

const gold: MantineColorsTuple = [
  '#f9f0dc',
  '#f0dcab',
  '#e5c67e',
  '#d8ae4f',
  '#c99a2c',
  '#b8860b', // gold
  '#a37509',
  '#886208',
  '#6c4d06',
  '#503905',
]

// Warm neutral standing in for Mantine's default cool `gray`, so borders,
// dimmed text, and disabled states read as parchment/ink rather than slate.
const ink: MantineColorsTuple = [
  '#f4f2ee',
  '#ddd6c1', // line
  '#b8b2a1',
  '#93917f',
  '#7c8074',
  '#66756c', // ink-soft
  '#4d574f',
  '#374039',
  '#2b352e',
  '#23302b', // ink
]

export const theme = createTheme({
  colors: { teal, saffron, jade, clay, gold, ink },
  primaryColor: 'saffron',
  primaryShade: { light: 6, dark: 6 },
  black: '#23302b',
  white: '#fdfbf4',
  defaultRadius: 'md',
  fontFamily: 'var(--font-body)',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  headings: {
    fontFamily: 'var(--font-display)',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2rem', fontWeight: '600', lineHeight: '1.2' },
      h2: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.25' },
      h3: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.3' },
      h4: { fontSize: '1.1rem', fontWeight: '600', lineHeight: '1.35' },
      h5: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.4' },
      h6: { fontSize: '0.875rem', fontWeight: '600', lineHeight: '1.4' },
    },
  },
  components: {
    AppShell: {
      styles: {
        main: { backgroundColor: 'var(--parchment)' },
      },
    },
    Table: {
      defaultProps: {
        highlightOnHover: true,
        highlightOnHoverColor: 'var(--saffron-pale)',
        horizontalSpacing: 'md',
        verticalSpacing: 'sm',
        borderColor: 'var(--line)',
        withRowBorders: true,
      },
      styles: {
        table: { backgroundColor: 'var(--paper)' },
        thead: { backgroundColor: 'var(--jade-pale)' },
        th: {
          color: 'var(--ink-soft)',
          fontWeight: 600,
          fontSize: '0.8125rem',
          borderBottomColor: 'var(--line)',
        },
        td: {
          borderBottomColor: 'var(--line)',
        },
      },
    },
    Paper: {
      defaultProps: { withBorder: true },
      styles: {
        root: { borderColor: 'var(--line)', backgroundColor: 'var(--paper)' },
      },
    },
    Modal: {
      styles: {
        content: { backgroundColor: 'var(--paper)' },
      },
    },
  },
  other: {
    parchment: 'var(--parchment)',
    paper: 'var(--paper)',
    ink: 'var(--ink)',
    inkSoft: 'var(--ink-soft)',
    line: 'var(--line)',
  },
})
