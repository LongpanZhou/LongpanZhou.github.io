// Hextech Theme Constants - League of Legends inspired design system

export const colors = {
  darkBlue: '#0A1428',
  gold: '#C8AA6E',
  cyan: '#0AC8FF',
  cream: '#F0E6D2',
  darkGold: '#A0885A',
  darkBg: '#010a13',
  textMuted: '#a09b8c',
} as const;

export const fonts = {
  heading: '"Beaufort for LOL", "Times New Roman", serif',
  body: '"Alatsi", sans-serif',
  mono: 'monospace',
} as const;

export const clipPaths = {
  button: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
  card: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
} as const;

export const gradients = {
  goldButton: 'linear-gradient(135deg, #C8AA6E 0%, #A0885A 100%)',
  darkPanel: 'linear-gradient(135deg, rgba(1, 10, 19, 0.95) 0%, rgba(10, 20, 40, 0.9) 100%)',
  headerFade: 'linear-gradient(180deg, rgba(1, 10, 19, 0.95) 0%, rgba(1, 10, 19, 0) 100%)',
} as const;

export const languageColors: Record<string, string> = {
  Python: '#3572A5',
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  'C++': '#F34B7D',
  C: '#555555',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Rust: '#DEA584',
  Go: '#00ADD8',
  Shell: '#89E051',
};
