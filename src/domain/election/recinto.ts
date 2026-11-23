import type { Jurisdiction } from './jurisdiction';

export type Recinto = Jurisdiction & {
  id: string;
  code: string;
  name: string;
  address: string;
  parish: string | null;
  gpsLat: number;
  gpsLng: number;
  radiusMeters: number;
  active: boolean;
};

export type CreateRecintoInput = Jurisdiction & {
  code: string;
  name: string;
  address: string;
  parish: string | null;
  gpsLat: number;
  gpsLng: number;
  radiusMeters: number;
};
