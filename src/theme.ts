export const THEME = {
  bg0: '#0d0e12',
  bg1: '#14161b',
  bg2: '#1a1d24',
  bg3: '#22262f',
  bg4: '#2a2f3a',
  border: '#272b34',
  borderSoft: '#1d2129',
  tx0: '#e7e9ee',
  tx1: '#a6acb9',
  tx2: '#6c7382',
  green: '#6cd093',
  red: '#e5737f',
  yellow: '#d9b06a',
  purple: '#b48ef0',
  cyan: '#5fc4d0',
  // syntax
  synKey: '#c191f0',
  synStr: '#9fd29b',
  synFn: '#6aa6ff',
  synNum: '#d9a36a',
  synCom: '#596170',
  synType: '#e0c46a',
  synPunc: '#a6acb9',
  uiFont: 'Inter_400Regular',
  uiFontMedium: 'Inter_500Medium',
  uiFontSemiBold: 'Inter_600SemiBold',
  uiFontBold: 'Inter_700Bold',
  monoFont: 'JetBrainsMono_400Regular',
  monoFontMedium: 'JetBrainsMono_500Medium',
} as const;

export type ThemeType = typeof THEME;

export const ACCENTS = {
  blue:   { hue: '#6aa6ff', dim: 'rgba(106,166,255,0.15)', on: '#0a1220' },
  green:  { hue: '#5fcf95', dim: 'rgba(95,207,149,0.15)',  on: '#06140d' },
  orange: { hue: '#e0a36a', dim: 'rgba(224,163,106,0.15)', on: '#1a1208' },
  purple: { hue: '#b48ef0', dim: 'rgba(180,142,240,0.15)', on: '#120a1c' },
} as const;

export type AccentName = keyof typeof ACCENTS;
export type AccentType = { hue: string; dim: string; on: string };

export function accentFor(name: string): AccentType {
  return (ACCENTS as Record<string, AccentType>)[name] || ACCENTS.blue;
}

export const PATHS: Record<string, string> = {
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  chevR: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  chevU: 'M6 15l6-6 6 6',
  more: 'M12 6h.01M12 12h.01M12 18h.01',
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M20 20l-3.5-3.5',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h3v3M20 14v6M17 20h3',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01',
  terminal: 'M5 6l5 5-5 5M12 17h7',
  folder: 'M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  file: 'M7 4h7l4 4v12H7zM14 4v4h4',
  git: 'M6 4v12M6 20m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M18 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M18 10c0 4-6 2-6 6',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6L6 18',
  send: 'M5 12l15-7-7 15-2-6-6-2z',
  at: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1',
  refresh: 'M4 9a8 8 0 0 1 13.7-3.3L20 8M20 4v4h-4M20 15a8 8 0 0 1-13.7 3.3L4 16M4 20v-4h4',
  dot: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4M15.5 9h.01',
  pdf: 'M7 4h7l4 4v12H7zM14 4v4h4M9.5 14v4M9.5 14h1.5a1 1 0 0 1 0 2H9.5M14 14v4M14 14h2M14 17h1.5',
  code: 'M9 8l-4 4 4 4M15 8l4 4-4 4',
  edit: 'M5 19h14M14 5l4 4-9 9H5v-4z',
  trash: 'M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  share: 'M12 3v12M8 6l4-4 4 4M5 11v9h14v-9',
  play: 'M7 5l11 7-11 7z',
  warn: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  wifiOff: 'M3 3l18 18M9 17h.01M5 12.5a10 10 0 0 1 4-2.3M2 8.8a16 16 0 0 1 4-2.4M22 8.8a16 16 0 0 0-7-3.5M18.5 12.5a10 10 0 0 0-2-1.3',
  branch: 'M6 4v12M6 20m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M18 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M18 10c0 4-6 2-6 6',
  key: 'M14 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 9l-8 8v3h3l1-1v-2h2v-2h2l1-1',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  thread: 'M5 6h14v9H9l-4 4z',
  settings: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0M12 3v2M12 19v2M5 5l1.5 1.5M17.5 17.5L19 19M3 12h2M19 12h2M5 19l1.5-1.5M17.5 6.5L19 5',
  link: 'M9 15l6-6M10 6l1-1a3.5 3.5 0 0 1 5 5l-1 1M14 18l-1 1a3.5 3.5 0 0 1-5-5l1-1',
  cmd: 'M9 6a3 3 0 1 0 0 6h6a3 3 0 1 0 0-6 3 3 0 0 0-3 3v6a3 3 0 1 0 3-3H9a3 3 0 1 0 3 3',
  doc: 'M7 4h7l4 4v12H7zM14 4v4h4M9.5 12h5M9.5 15h5M9.5 18h3',
  shield: 'M12 3l7 3v5.5c0 4-3 6.8-7 8-4-1.2-7-4-7-8V6z',
  spark: 'M12 4l1.7 4.6L18 10l-4.3 1.4L12 16l-1.7-4.6L6 10l4.3-1.4zM18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  chip: 'M8 8h8v8H8zM10 4v2M14 4v2M10 18v2M14 18v2M4 10h2M4 14h2M18 10h2M18 14h2',
  expand: 'M9 4H5v4M15 4h4v4M9 20H5v-4M15 20h4v-4',
  slash: 'M16 4L8 20',
  image2: 'M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4M15.5 9h.01',
};
