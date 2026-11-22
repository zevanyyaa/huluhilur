// Inline crisp SVG icons and illustrations for Hulu Guard (offline-ready)

export const Icons = {
  mountain: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    </svg>`,

  trash: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
    </svg>`,

  bell: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>`,

  camera: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
      <circle cx="12" cy="13" r="3"/>
    </svg>`,

  gallery: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
      <circle cx="9" cy="9" r="2"/>
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
    </svg>`,

  flipCamera: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/>
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>`,

  flash: (cls = 'w-5 h-5', on = false) => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>`,

  mail: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>`,

  lock: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`,

  eye: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>`,

  eyeOff: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>`,

  arrowLeft: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>
    </svg>`,

  arrowRight: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>`,

  chevronDown: (cls = 'w-4 h-4') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 9 6 6 6-6"/>
    </svg>`,

  dashboard: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <rect width="7" height="7" x="3" y="3" rx="1.5"/>
      <rect width="7" height="7" x="14" y="3" rx="1.5"/>
      <rect width="7" height="7" x="14" y="14" rx="1.5"/>
      <rect width="7" height="7" x="3" y="14" rx="1.5"/>
    </svg>`,

  history: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
    </svg>`,

  badge: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>`,

  user: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`,

  leaf: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>`,

  checkCircle: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <path d="m9 11 3 3L22 4"/>
    </svg>`,

  alertTriangle: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
      <path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>`,

  upload: (cls = 'w-5 h-5') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
    </svg>`,

  wifiOff: (cls = 'w-4 h-4') => `
    <svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="2" x2="22" y1="2" y2="22"/>
      <path d="M8.5 16.5a5 5 0 0 1 7 0"/>
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65"/>
      <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/>
    </svg>`
};

// Layered Earthy Forest & Sage mountain illustration matching LoginView mockup
export function mountainBannerSvg() {
  return `
    <svg viewBox="0 0 360 156" class="w-full h-full block" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="hgSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F2F6F0"/>
          <stop offset="100%" stop-color="#E6EFE3"/>
        </linearGradient>
      </defs>
      <rect width="360" height="156" fill="url(#hgSky)"/>
      <!-- Sun -->
      <circle cx="268" cy="40" r="18" fill="#D4EEA8"/>
      <!-- Far mountain ridge -->
      <path d="M0 112 L52 62 L108 92 L176 42 L248 84 L305 56 L360 96 L360 156 L0 156 Z" fill="#C4D8C1"/>
      <!-- Mid mountain ridge -->
      <path d="M0 124 L68 78 L124 108 L184 52 L246 98 L314 72 L360 108 L360 156 L0 156 Z" fill="#89A98D"/>
      <!-- Main mountain peak -->
      <path d="M72 156 L176 44 L268 156 Z" fill="#52775E"/>
      <path d="M176 44 L224 102 L194 98 L178 118 L158 96 L176 44 Z" fill="#3D614B"/>
      <!-- Winding trail -->
      <path d="M150 156 C158 140 198 136 184 118 C172 104 150 102 174 84 C186 75 182 64 176 58" fill="none" stroke="#F8FAF7" stroke-width="5" stroke-linecap="round"/>
      <!-- Tiny hiker silhouette on trail -->
      <circle cx="176" cy="96" r="2.6" fill="#1B3B2B"/>
      <path d="M176 99 L174 107 M176 100 L179 106 M174 102 L179 101" stroke="#1B3B2B" stroke-width="1.8" stroke-linecap="round"/>
      <!-- Foreground dark forest ridges & pine trees -->
      <path d="M0 122 L84 146 L160 156 L0 156 Z" fill="#234734"/>
      <path d="M180 156 L276 132 L360 114 L360 156 Z" fill="#1B3B2B"/>
      <!-- Pine trees left -->
      <g fill="#1B3B2B">
        <polygon points="24,148 34,114 44,148"/>
        <polygon points="48,152 60,104 72,152"/>
        <polygon points="74,154 84,120 94,154"/>
        <polygon points="104,156 112,130 120,156"/>
      </g>
      <!-- Pine trees right -->
      <g fill="#142C20">
        <polygon points="222,156 232,126 242,156"/>
        <polygon points="246,154 258,112 270,154"/>
        <polygon points="274,152 288,100 302,152"/>
        <polygon points="306,150 318,116 330,150"/>
        <polygon points="334,152 346,120 358,152"/>
      </g>
    </svg>
  `;
}
