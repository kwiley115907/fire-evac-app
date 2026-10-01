// Small illustrations for the landing page's three views. Static SVG with
// the same CSS motion classes the real canvas uses.

const ROOM = 'rgba(160,200,240,0.28)';

export function LifelineArt() {
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g fill="rgba(120,170,220,0.05)" stroke={ROOM} strokeWidth="1">
        <rect x="18" y="16" width="96" height="62" rx="3" />
        <rect x="114" y="16" width="80" height="62" rx="3" />
        <rect x="194" y="16" width="96" height="62" rx="3" />
        <rect x="18" y="78" width="272" height="26" rx="3" />
        <rect x="18" y="104" width="130" height="34" rx="3" />
        <rect x="290" y="80" width="18" height="22" rx="3" fill="rgba(47,227,154,0.2)" stroke="#2fe39a" />
      </g>
      <defs>
        <linearGradient id="la-g" x1="0" x2="1">
          <stop offset="0" stopColor="#ff5a36" />
          <stop offset="0.5" stopColor="#ffb547" />
          <stop offset="1" stopColor="#2fe39a" />
        </linearGradient>
      </defs>
      <path d="M60 46 L66 78 L150 91 L290 91" fill="none" stroke="#2fe39a" strokeOpacity="0.18" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 46 L66 78 L150 91 L290 91" fill="none" stroke="url(#la-g)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 46 L66 78 L150 91 L290 91" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="0.1 9" strokeLinecap="round" className="art-march" />
      {[
        [108, 84, '0:20'],
        [196, 91, '0:10'],
      ].map(([x, y, t]) => (
        <g key={t as string}>
          <circle cx={x as number} cy={y as number} r="3.5" fill="#070a0f" stroke="#fff" strokeWidth="1.2" />
          <text x={x as number} y={(y as number) - 8} fontSize="9" textAnchor="middle" fill="#fff" fontFamily="ui-monospace, monospace">
            {t}
          </text>
        </g>
      ))}
      <circle cx="60" cy="46" r="6" fill="#ff5a36" stroke="#fff" strokeWidth="2" />
      <rect x="276" y="60" width="30" height="14" rx="4" fill="#2fe39a" />
      <text x="291" y="70.5" fontSize="8.5" fontWeight="800" textAnchor="middle" fill="#070a0f" fontFamily="system-ui, sans-serif">
        EXIT
      </text>
    </svg>
  );
}

export function FieldArt() {
  const streams = [
    'M40 30 C 70 40, 90 70, 150 82',
    'M40 120 C 80 112, 110 96, 150 86',
    'M110 22 C 120 50, 135 70, 150 80',
    'M120 132 C 130 110, 140 96, 150 88',
  ];
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      <g stroke={ROOM} strokeWidth="1">
        <rect x="14" y="12" width="70" height="50" rx="3" fill="hsla(20,88%,58%,0.18)" />
        <rect x="14" y="88" width="70" height="50" rx="3" fill="hsla(40,88%,58%,0.18)" />
        <rect x="84" y="12" width="66" height="50" rx="3" fill="hsla(70,88%,58%,0.16)" />
        <rect x="84" y="88" width="66" height="50" rx="3" fill="hsla(90,88%,58%,0.16)" />
        <rect x="150" y="62" width="130" height="44" rx="3" fill="hsla(130,88%,58%,0.14)" />
        <rect x="280" y="72" width="26" height="24" rx="3" fill="rgba(47,227,154,0.3)" stroke="#2fe39a" />
      </g>
      {streams.map((d) => (
        <g key={d}>
          <path d={d} fill="none" stroke="#2fe39a" strokeOpacity="0.15" strokeWidth="7" strokeLinecap="round" />
          <path d={d} fill="none" stroke="#2fe39a" strokeWidth="2.5" strokeDasharray="0.1 9" strokeLinecap="round" className="art-march" />
        </g>
      ))}
      <path d="M150 84 L292 84" fill="none" stroke="#2fe39a" strokeOpacity="0.18" strokeWidth="18" strokeLinecap="round" />
      <path d="M150 84 L292 84" fill="none" stroke="#2fe39a" strokeWidth="7" strokeDasharray="0.1 9" strokeLinecap="round" className="art-march" />
      <text x="50" y="42" fontSize="10" textAnchor="middle" fill="#ff8a60" fontFamily="ui-monospace, monospace" fontWeight="700">
        0:48
      </text>
      <text x="117" y="42" fontSize="10" textAnchor="middle" fill="#d6e05a" fontFamily="ui-monospace, monospace" fontWeight="700">
        0:31
      </text>
      <text x="215" y="76" fontSize="10" textAnchor="middle" fill="#2fe39a" fontFamily="ui-monospace, monospace" fontWeight="700">
        0:09
      </text>
    </svg>
  );
}

export function StackArt() {
  const plate = (y: number) => `M70 ${y} L170 ${y - 26} L270 ${y} L170 ${y + 26} Z`;
  return (
    <svg viewBox="0 0 320 150" aria-hidden="true">
      {[118, 80, 42].map((y, i) => (
        <g key={y}>
          <path d={plate(y + 4)} fill="#05080c" />
          <path d={plate(y)} fill={i === 0 ? 'rgba(47,227,154,0.14)' : 'rgba(22,34,48,0.85)'} stroke={i === 2 ? 'rgba(76,201,255,0.6)' : ROOM} strokeWidth="1" />
          <text x="60" y={y + 4} fontSize="10" textAnchor="end" fill={i === 2 ? '#4cc9ff' : '#6f8293'} fontFamily="ui-monospace, monospace" fontWeight="800">
            F{i + 1}
          </text>
        </g>
      ))}
      <path d="M214 42 L214 118" stroke="#2fe39a" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M140 36 L214 42 L214 118 L250 112" fill="none" stroke="#2fe39a" strokeOpacity="0.2" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M140 36 L214 42 L214 118 L250 112" fill="none" stroke="#2fe39a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M140 36 L214 42 L214 118 L250 112" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="0.1 9" strokeLinecap="round" className="art-march" />
      <circle cx="140" cy="36" r="5" fill="#ff5a36" stroke="#fff" strokeWidth="1.5" />
      <circle cx="250" cy="112" r="5" fill="#2fe39a" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function DrillArt() {
  return (
    <svg viewBox="0 0 420 260" aria-hidden="true" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <g stroke={ROOM} strokeWidth="1.2" fill="rgba(120,170,220,0.05)">
        <rect x="20" y="20" width="120" height="90" rx="4" />
        <rect x="140" y="20" width="120" height="90" rx="4" />
        <rect x="260" y="20" width="120" height="90" rx="4" />
        <rect x="20" y="110" width="360" height="40" rx="4" />
        <rect x="20" y="150" width="170" height="90" rx="4" />
        <rect x="190" y="150" width="190" height="90" rx="4" fill="rgba(255,90,54,0.2)" stroke="rgba(255,90,54,0.6)" />
        <rect x="380" y="114" width="26" height="32" rx="4" fill="rgba(47,227,154,0.25)" stroke="#2fe39a" />
        <rect x="60" y="0" width="40" height="20" rx="4" fill="rgba(47,227,154,0.25)" stroke="#2fe39a" />
      </g>
      <g className="flame-art">
        <path transform="translate(262 168) scale(2.2)" d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.1 2.2-5.1 3.4-6.9.4 1.6 1.3 2.6 2.2 3.1C11 7.6 12.4 4.8 15 3c-.4 3 .9 4.8 2.1 6.6 1 1.4 1.4 3 1.4 4.6 0 4-2.6 6.8-6.5 6.8z" fill="#ff5a36" />
      </g>
      <path d="M200 65 L200 110 L330 130 L392 130" fill="none" stroke="#ff5a36" strokeWidth="3" strokeDasharray="6 6" strokeOpacity="0.55" strokeLinecap="round" />
      <path d="M200 65 L200 110 L80 110 L80 20" fill="none" stroke="#2fe39a" strokeOpacity="0.2" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M200 65 L200 110 L80 110 L80 20" fill="none" stroke="#2fe39a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M200 65 L200 110 L80 110 L80 20" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="0.1 9" strokeLinecap="round" className="art-march" />
      <circle cx="200" cy="65" r="7" fill="#ff5a36" stroke="#fff" strokeWidth="2" />
      <g transform="translate(250 82)">
        <rect width="150" height="26" rx="13" fill="rgba(15,21,30,0.95)" stroke="rgba(47,227,154,0.6)" />
        <text x="75" y="17" fontSize="11" textAnchor="middle" fill="#b5fadb" fontFamily="system-ui, sans-serif" fontWeight="700">
          Rerouted — via Front Exit
        </text>
      </g>
    </svg>
  );
}

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="bm-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5a36" />
          <stop offset="1" stopColor="#2fe39a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0f151e" stroke="rgba(160,200,240,0.25)" />
      <path d="M8 7h16v6M24 19v6H8V7" fill="none" stroke="rgba(160,200,240,0.45)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.5 21.5c0-4 3-5.5 6-5.5h10" fill="none" stroke="url(#bm-g)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M24.5 13l3 3-3 3" fill="none" stroke="#2fe39a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11.5" cy="21.5" r="2.2" fill="#ff5a36" />
    </svg>
  );
}

export function ScanArt() {
  // A phone filming a corridor with the trail painted on the floor, and
  // the same walk rebuilt in 3D beside it.
  return (
    <svg viewBox="0 0 420 260" aria-hidden="true" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="sa-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1017" />
          <stop offset="1" stopColor="#1a2431" />
        </linearGradient>
        <linearGradient id="sa-path" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff5a36" />
          <stop offset="0.5" stopColor="#ffb547" />
          <stop offset="1" stopColor="#2fe39a" />
        </linearGradient>
      </defs>
      <rect x="22" y="14" width="136" height="232" rx="22" fill="#05080c" stroke="rgba(160,200,240,0.35)" strokeWidth="2" />
      <rect x="30" y="26" width="120" height="208" rx="14" fill="url(#sa-floor)" />
      <path d="M30 120 L72 96 L108 96 L150 120" fill="none" stroke="rgba(160,200,240,0.2)" />
      <path d="M72 96 V40 M108 96 V40" stroke="rgba(160,200,240,0.14)" />
      {[
        [90, 226, 7],
        [90, 196, 6],
        [91, 170, 5],
        [93, 148, 4.2],
        [96, 130, 3.6],
        [99, 116, 3],
        [101, 106, 2.4],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#2fe39a" opacity={1 - i * 0.1} />
      ))}
      <circle cx="90" cy="130" r="14" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <rect x="38" y="34" width="38" height="13" rx="6.5" fill="rgba(0,0,0,0.6)" />
      <circle cx="46" cy="40.5" r="2.6" fill="#ff5a36" />
      <text x="51" y="44" fontSize="7.5" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">
        REC
      </text>
      <circle cx="90" cy="212" r="10" fill="#ff5a36" stroke="#fff" strokeWidth="2.5" />

      <path d="M178 130 h28 M198 122 l9 8 -9 8" fill="none" stroke="rgba(160,200,240,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {[78, 150, 222].map((y) => (
        <path key={y} d={`M226 ${y} L318 ${y - 34} L404 ${y} L312 ${y + 34} Z`} fill="rgba(22,34,48,0.5)" stroke="rgba(76,201,255,0.28)" />
      ))}
      <path d="M262 70 L300 56 L344 72 L352 92 L326 116 L352 140 L326 164 L352 188 L380 206" fill="none" stroke="#2fe39a" strokeOpacity="0.22" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M262 70 L300 56 L344 72 L352 92 L326 116 L352 140 L326 164 L352 188 L380 206" fill="none" stroke="url(#sa-path)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M262 70 L300 56 L344 72 L352 92 L326 116 L352 140 L326 164 L352 188 L380 206" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="0.1 9" strokeLinecap="round" className="art-march" />
      <circle cx="262" cy="70" r="5" fill="#ff5a36" stroke="#fff" strokeWidth="1.5" />
      <circle cx="380" cy="206" r="5" fill="#2fe39a" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
