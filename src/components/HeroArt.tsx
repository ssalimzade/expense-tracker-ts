import type { ReactNode } from "react";

/**
 * The big faint line icon in the corner of a tab's gradient header. All share
 * one stroke style (like Rent's house) so they read as a set.
 */
function Art({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`pointer-events-none absolute -right-6 -top-4 h-60 w-60 text-white/10 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

type P = { className?: string };

export const WalletArt = ({ className }: P) => (
  <Art className={className}>
    <path d="M32 62 L138 32 a8 8 0 0 1 10 8 V62" />
    <rect x="30" y="62" width="145" height="108" rx="12" />
    <path d="M175 95 H140 a15 15 0 0 0 0 30 H175" />
    <circle cx="142" cy="110" r="3" />
  </Art>
);

export const RewindClockArt = ({ className }: P) => (
  <Art className={className}>
    <path d="M100 40 A62 62 0 1 1 46 72" />
    <path d="M46 42 V72 H76" />
    <path d="M100 72 V104 L124 118" />
  </Art>
);

export const TrendArt = ({ className }: P) => (
  <Art className={className}>
    <path d="M28 150 L78 100 L108 124 L170 60" />
    <path d="M132 60 H170 V98" />
    <path d="M28 178 H176" />
  </Art>
);

export const HouseArt = ({ className }: P) => (
  <Art className={className}>
    <path d="M20 95 L100 25 L180 95 V180 H20 Z" />
    <path d="M80 180 V120 H120 V180" />
  </Art>
);

export const CardArt = ({ className }: P) => (
  <Art className={className}>
    <rect x="22" y="50" width="156" height="104" rx="14" />
    <path d="M22 84 H178" />
    <path d="M44 126 H88" />
    <path d="M140 126 H156" />
  </Art>
);

export const BanknotesArt = ({ className }: P) => (
  <Art className={className}>
    <path d="M40 44 H172 a10 10 0 0 1 10 10 V132" />
    <rect x="18" y="64" width="150" height="92" rx="10" />
    <circle cx="93" cy="110" r="22" />
    <path d="M40 90 V90 M146 130 V130" />
  </Art>
);

export const CoinsArt = ({ className }: P) => (
  <Art className={className}>
    <ellipse cx="100" cy="58" rx="56" ry="18" />
    <path d="M44 58 V88 a56 18 0 0 0 112 0 V58" />
    <path d="M44 88 V118 a56 18 0 0 0 112 0 V88" />
    <path d="M44 118 V148 a56 18 0 0 0 112 0 V118" />
  </Art>
);

export const CalendarArt = ({ className }: P) => (
  <Art className={className}>
    <rect x="28" y="44" width="144" height="130" rx="14" />
    <path d="M28 86 H172" />
    <path d="M68 28 V58 M132 28 V58" />
    <path d="M62 116 h4 M98 116 h4 M134 116 h4 M62 146 h4 M98 146 h4" strokeWidth="10" />
  </Art>
);

export const PlaneArt = ({ className }: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="0.72"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`pointer-events-none absolute text-white/10 ${className ?? "-right-6 -top-4 h-60 w-60"}`}
    aria-hidden
  >
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  </svg>
);
