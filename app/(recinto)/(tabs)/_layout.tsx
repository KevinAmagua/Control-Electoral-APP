import { Tabs } from 'expo-router';

import { tabIcon, tabScreenOptions } from '@/presentation/navigation/tab-options';

export default function RecintoTabsLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="recinto"
        options={{ title: 'Recinto', tabBarLabel: 'Inicio', tabBarIcon: tabIcon('inicio') }}
      />
      <Tabs.Screen
        name="asignar-veedores"
        options={{ title: 'Veedores', tabBarLabel: 'Veedores', tabBarIcon: tabIcon('veedores') }}
      />
      <Tabs.Screen
        name="revision-acta"
        options={{ title: 'Actas', tabBarLabel: 'Actas', tabBarIcon: tabIcon('actas') }}
      />
      <Tabs.Screen
        name="conflictos"
        options={{ title: 'Conflictos', tabBarLabel: 'Conflictos', tabBarIcon: tabIcon('conflictos') }}
      />
      <Tabs.Screen
        name="perfil-recinto"
        options={{ title: 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: tabIcon('perfil') }}
      />
    </Tabs>
  );
}
