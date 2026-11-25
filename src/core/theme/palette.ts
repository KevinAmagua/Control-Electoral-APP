export const palette = {
  primary: '#9854B3',
  primaryDark: '#6F2C91',
  primaryLight: '#B889CB',
  mapOverlay: 'rgba(152,84,179,0.22)',
  accent: '#FFEC4E',
  accentDark: '#E9E74A',
  background: '#160C1D',
  surface: '#271534',
  border: '#4E3560',
  text: '#FFFDF5',
  textMuted: '#CDB7D8',
  success: '#67C58B',
  warning: '#FFEC4E',
  danger: '#F07878',
  onPrimary: '#FFFFFF',
  onAccent: '#2A1733',
} as const;

export type Palette = typeof palette;
