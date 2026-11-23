export const palette = {
  primary: '#83B8E8',
  primaryDark: '#14264B',
  primaryLight: '#1E3558',
  mapOverlay: 'rgba(131,184,232,0.22)',
  accent: '#F2C744',
  accentDark: '#D8AC26',
  background: '#0B1423',
  surface: '#14233A',
  border: '#34445C',
  text: '#F5F2E8',
  textMuted: '#B4C0D2',
  success: '#67C58B',
  warning: '#F2C744',
  danger: '#F07878',
  onPrimary: '#10203B',
  onAccent: '#14264B',
} as const;

export type Palette = typeof palette;
