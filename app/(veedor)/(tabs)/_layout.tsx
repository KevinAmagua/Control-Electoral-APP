import { Tabs } from 'expo-router';

import { tabIcon, tabScreenOptions } from '@/presentation/navigation/tab-options';

export default function VeedorTabsLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="mesas"
        options={{ title: 'Mesas', tabBarLabel: 'Mesas', tabBarIcon: tabIcon('mesas') }}
      />
      <Tabs.Screen
        name="estados-acta"
        options={{ title: 'Estados', tabBarLabel: 'Estados', tabBarIcon: tabIcon('estados') }}
      />
      <Tabs.Screen
        name="perfil-veedor"
        options={{ title: 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: tabIcon('perfil') }}
      />
    </Tabs>
  );
}
