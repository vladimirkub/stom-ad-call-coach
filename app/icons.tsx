// Thin-stroke line icons (1.5px) used across the workspace. Decorative unless a label is passed.
type Props = { className?: string };

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function ArrowUpRight({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function Phone({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M5 4h3.2l1.6 4-2 1.3a10.5 10.5 0 0 0 6.9 6.9l1.3-2 4 1.6V19a1.6 1.6 0 0 1-1.7 1.6A16 16 0 0 1 3.4 5.7 1.6 1.6 0 0 1 5 4Z" />
    </svg>
  );
}

export function Spark({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5" />
    </svg>
  );
}

export function Waveform({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 7v10M21 12h0" />
    </svg>
  );
}

export function Calculator({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01" />
    </svg>
  );
}

export function ArrowLeft({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function Mic({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

export function MicOff({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M15 9.5V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5M5.5 11a6.5 6.5 0 0 0 10.8 4.9M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16" />
    </svg>
  );
}

export function Check({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Cross({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </svg>
  );
}

export function Alert({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 4 2.8 19.5h18.4L12 4ZM12 10v4.5M12 17.2h.01" />
    </svg>
  );
}

export function Play({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />
    </svg>
  );
}

export function Stop({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2" />
    </svg>
  );
}

export function Upload({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

export function Keyhole({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 13.5V17" />
    </svg>
  );
}

export function Chart({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M4 20h16M7 16v-4M12 16V8M17 16v-7" />
    </svg>
  );
}

export function Target({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12h.01" />
    </svg>
  );
}

export function Door({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M6 20V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v15M4 20h16M14.5 12h.01" />
    </svg>
  );
}

export function Book({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6" />
    </svg>
  );
}
