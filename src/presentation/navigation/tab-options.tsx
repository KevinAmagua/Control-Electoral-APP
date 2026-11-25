import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { palette, typography } from '@/core/theme';

export type TabIconName =
  | 'inicio'
  | 'mesas'
  | 'actas'
  | 'recintos'
  | 'veedores'
  | 'conflictos'
  | 'estados'
  | 'perfil';

const symbols = {
  inicio: { ios: 'house.fill', android: 'home', web: 'home' },
  mesas: { ios: 'tablecells.fill', android: 'table_chart', web: 'table_chart' },
  actas: { ios: 'doc.text.fill', android: 'description', web: 'description' },
  recintos: { ios: 'building.2.fill', android: 'domain', web: 'domain' },
  veedores: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  conflictos: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  estados: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  perfil: { ios: 'person.circle.fill', android: 'person', web: 'person' },
} as const;

export function tabIcon(name: TabIconName) {
  function TabIcon({ color, size }: { focused: boolean; color: ColorValue; size: number }) {
    return <SymbolView name={symbols[name]} size={size} tintColor={color} />;
  }
  TabIcon.displayName = `TabIcon(${name})`;
  return TabIcon;
}

export const tabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: palette.accent,
  tabBarInactiveTintColor: palette.textMuted,
  tabBarStyle: {
    backgroundColor: palette.surface,
    borderTopColor: palette.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabBarLabelStyle: {
    fontSize: typography.caption,
    fontWeight: '700',
  },
} as const;
