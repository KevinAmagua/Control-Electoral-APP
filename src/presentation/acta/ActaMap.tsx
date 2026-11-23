import { AppleMaps, GoogleMaps, type CameraPosition, type Coordinates } from 'expo-maps';
import { Platform, StyleSheet } from 'react-native';

import { palette, radius } from '@/core/theme';

export type ActaMapProps = {
  actaLat: number;
  actaLng: number;
  recintoLat: number;
  recintoLng: number;
  radiusMeters: number;
  outsideRadius: boolean;
  actaLabel: string;
  recintoLabel: string;
};

export function ActaMap({
  actaLat,
  actaLng,
  recintoLat,
  recintoLng,
  radiusMeters,
  outsideRadius,
  actaLabel,
  recintoLabel,
}: ActaMapProps) {
  const actaCoordinates: Coordinates = { latitude: actaLat, longitude: actaLng };
  const recintoCoordinates: Coordinates = { latitude: recintoLat, longitude: recintoLng };
  const cameraPosition: CameraPosition = { coordinates: actaCoordinates, zoom: 15 };
  const actaTone = outsideRadius ? palette.danger : palette.success;

  if (Platform.OS === 'ios') {
    const markers: AppleMaps.Marker[] = [
      {
        id: 'acta',
        coordinates: actaCoordinates,
        title: actaLabel,
        tintColor: actaTone,
      },
      {
        id: 'recinto',
        coordinates: recintoCoordinates,
        title: recintoLabel,
        tintColor: palette.primary,
      },
    ];
    const circles: AppleMaps.Circle[] = [
      {
        id: 'radio-recinto',
        center: recintoCoordinates,
        radius: radiusMeters,
        color: palette.mapOverlay,
        lineColor: palette.primary,
        lineWidth: 2,
      },
    ];

    return (
      <AppleMaps.View
        style={styles.map}
        cameraPosition={cameraPosition}
        markers={markers}
        circles={circles}
      />
    );
  }

  const markers: GoogleMaps.Marker[] = [
    {
      id: 'acta',
      coordinates: actaCoordinates,
      title: actaLabel,
      snippet: outsideRadius ? 'Fuera del radio permitido' : 'Dentro del radio permitido',
      showCallout: true,
    },
    {
      id: 'recinto',
      coordinates: recintoCoordinates,
      title: recintoLabel,
      showCallout: true,
    },
  ];
  const circles: GoogleMaps.Circle[] = [
    {
      id: 'radio-recinto',
      center: recintoCoordinates,
      radius: radiusMeters,
      color: palette.mapOverlay,
      lineColor: palette.primary,
      lineWidth: 2,
    },
  ];

  return (
    <GoogleMaps.View
      style={styles.map}
      cameraPosition={cameraPosition}
      markers={markers}
      circles={circles}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    height: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
