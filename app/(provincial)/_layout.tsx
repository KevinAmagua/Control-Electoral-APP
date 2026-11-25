import { Tabs } from 'expo-router';

import { tabIcon, tabScreenOptions } from '@/presentation/navigation/tab-options';

export default function ProvincialLayout() {
  return (
    <Tabs screenOptions={tabScreenOptions}>
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Panel', tabBarLabel: 'Panel', tabBarIcon: tabIcon('inicio') }}
      />
      <Tabs.Screen
        name="revision-actas"
        options={{ title: 'Actas', tabBarLabel: 'Actas', tabBarIcon: tabIcon('actas') }}
      />
      <Tabs.Screen
        name="gestion-recintos"
        options={{ title: 'Recintos', tabBarLabel: 'Recintos', tabBarIcon: tabIcon('recintos') }}
      />
      <Tabs.Screen
        name="perfil-provincial"
        options={{ title: 'Perfil', tabBarLabel: 'Perfil', tabBarIcon: tabIcon('perfil') }}
      />
    </Tabs>
  );
}
