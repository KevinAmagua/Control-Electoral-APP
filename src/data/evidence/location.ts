import { failure, ok, type Result } from '@/core/result/result';
import { GPS_ALERT_RADIUS_METERS } from '@/domain/election/jurisdiction';
import type { Recinto } from '@/domain/election/recinto';
import * as Location from 'expo-location';

export type VerifiedLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters: number;
  radiusMeters: number;
  outsideRadius: boolean;
};

export type CurrentPlace = {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string | null;
  parish: string | null;
  warning: string | null;
};

function formatGeocodedAddress(place: Location.LocationGeocodedAddress): string | null {
  if (place.formattedAddress) {
    return place.formattedAddress;
  }
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
  const parts = [
    street || place.name,
    place.district,
    place.subregion,
    place.city,
    place.region,
    place.postalCode,
  ]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  return parts.length > 0 ? parts.join(', ') : null;
}

export async function getCurrentPlace(): Promise<Result<CurrentPlace>> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return failure('UBICACION_SIN_PERMISO', 'Permita el acceso a la ubicación para obtener los datos del recinto');
    }

    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      return failure('UBICACION_NO_DISPONIBLE', 'Active el GPS del dispositivo para obtener la ubicación');
    }

    const samples = await Promise.all(
      Array.from({ length: 3 }, () =>
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      ),
    );
    const best = samples.reduce((selected, current) => {
      const currentAccuracy = current.coords.accuracy ?? Number.POSITIVE_INFINITY;
      const selectedAccuracy = selected.coords.accuracy ?? Number.POSITIVE_INFINITY;
      return currentAccuracy < selectedAccuracy ? current : selected;
    });
    const coordinates = {
      latitude: best.coords.latitude,
      longitude: best.coords.longitude,
    };

    let address: string | null = null;
    let parish: string | null = null;
    let warning: string | null = null;
    try {
      const results = await Location.reverseGeocodeAsync(coordinates);
      const place = results[0];
      if (place) {
        address = formatGeocodedAddress(place);
        parish = place.district ?? place.subregion ?? null;
      }
      if (!address) {
        warning = 'Ubicación obtenida. Ingrese la dirección manualmente porque no se pudo resolver.';
      }
    } catch {
      warning = 'Ubicación obtenida. Ingrese la dirección manualmente porque no se pudo resolver.';
    }

    return ok({
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: best.coords.accuracy ?? 0,
      address,
      parish,
      warning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible obtener la ubicación';
    return failure('UBICACION_NO_DISPONIBLE', message);
  }
}

function distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function captureRecintoLocation(
  recinto: Recinto,
  sampleCount = 4,
): Promise<Result<VerifiedLocation>> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return failure('UBICACION_SIN_PERMISO', 'Permita el acceso a la ubicación para registrar el acta');
    }

    const samples: Location.LocationObject[] = [];
    for (let index = 0; index < Math.max(1, sampleCount); index += 1) {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });
      samples.push(position);
    }

    const best = samples.reduce((selected, current) => {
      const currentAccuracy = current.coords.accuracy ?? Number.POSITIVE_INFINITY;
      const selectedAccuracy = selected.coords.accuracy ?? Number.POSITIVE_INFINITY;
      return currentAccuracy < selectedAccuracy ? current : selected;
    });

    const radiusMeters = recinto.radiusMeters || GPS_ALERT_RADIUS_METERS;
    const distanceMeters = distanceInMeters(
      best.coords.latitude,
      best.coords.longitude,
      recinto.gpsLat,
      recinto.gpsLng,
    );

    return ok({
      latitude: best.coords.latitude,
      longitude: best.coords.longitude,
      accuracy: best.coords.accuracy ?? 0,
      distanceMeters: Math.round(distanceMeters),
      radiusMeters,
      outsideRadius: distanceMeters > radiusMeters,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No fue posible obtener la ubicación';
    return failure('UBICACION_NO_DISPONIBLE', message);
  }
}
