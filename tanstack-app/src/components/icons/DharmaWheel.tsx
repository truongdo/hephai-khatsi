import type { SVGProps } from 'react'

export type DharmaWheelProps = SVGProps<SVGSVGElement> & {
  size?: number | string
}

// Eight-spoke Dharmacakra (bánh xe Pháp) — the Eightfold Path. Hand-drawn to
// match lucide-react's icon conventions (24x24, stroke-based, round caps) so
// it composes alongside lucide icons wherever the app needs a brand mark.
export function DharmaWheel({ size = 24, ...props }: DharmaWheelProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <line x1="14.5" y1="12" x2="21" y2="12" />
      <line x1="13.77" y1="13.77" x2="18.36" y2="18.36" />
      <line x1="12" y1="14.5" x2="12" y2="21" />
      <line x1="10.23" y1="13.77" x2="5.64" y2="18.36" />
      <line x1="9.5" y1="12" x2="3" y2="12" />
      <line x1="10.23" y1="10.23" x2="5.64" y2="5.64" />
      <line x1="12" y1="9.5" x2="12" y2="3" />
      <line x1="13.77" y1="10.23" x2="18.36" y2="5.64" />
    </svg>
  )
}
