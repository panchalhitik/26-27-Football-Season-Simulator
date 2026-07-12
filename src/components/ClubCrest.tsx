import type { Club } from '@/types';

/**
 * Generated crest badge — a shield in the club's real colors with its code.
 * Keeps every asset bundled + on-brand without trademarked artwork.
 */
export function ClubCrest({ club, size = 64 }: { club: Club; size?: number }) {
  const code = crestCode(club.shortName);
  const id = `crest-${club.id}`;
  return (
    <svg
      width={size}
      height={size * 1.15}
      viewBox="0 0 100 115"
      role="img"
      aria-label={`${club.name} crest`}
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={club.primaryColor} />
          <stop offset="100%" stopColor={shade(club.primaryColor, -30)} />
        </linearGradient>
      </defs>
      {/* shield */}
      <path
        d="M50 4 L92 16 V58 Q92 92 50 111 Q8 92 8 58 V16 Z"
        fill={`url(#${id}-g)`}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="3"
      />
      {/* secondary chevron */}
      <path
        d="M8 40 L50 54 L92 40 V58 Q92 92 50 111 Q8 92 8 58 Z"
        fill={club.secondaryColor}
        opacity="0.22"
      />
      {/* club code */}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        fontFamily="'Archivo Black', sans-serif"
        fontSize="26"
        fill="#ffffff"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.8"
      >
        {code}
      </text>
      {/* star */}
      <text x="50" y="82" textAnchor="middle" fontSize="18" fill="rgba(255,255,255,0.85)">
        ★
      </text>
    </svg>
  );
}

function crestCode(shortName: string): string {
  const words = shortName.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 3);
  }
  return shortName.slice(0, 3).toUpperCase();
}

/** Lighten/darken a hex color by `amt` (−255..255). */
function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '');
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n;
  const num = parseInt(full, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
