type IconProps = { className?: string };

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function OverviewIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="12" width="4" height="9" />
      <rect x="10" y="7" width="4" height="14" />
      <rect x="17" y="3" width="4" height="18" />
    </svg>
  );
}

export function LojasIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M9 20v-6h6v6" />
    </svg>
  );
}

export function FornecedoresIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M16.5 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
      <path d="M7.5 10.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
      <path d="M4 21c0-2.8 2-5 5-5" />
      <path d="M20 12c0-2.8-2-5-5-5" />
    </svg>
  );
}

export function BridgeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 18c2-4 5-6 10-6s8 2 10 6" />
      <path d="M5 18v-3M9 18v-5M13 18v-5M17 18v-3" />
    </svg>
  );
}

export function SegmentosIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 2l3 6 6 1-4.5 4.5L17.5 21 12 17.5 6.5 21l1-7.5L3 9l6-1Z" />
    </svg>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <svg {...base} width={14} height={14} className={className}>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...base} width={14} height={14} className={className}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
