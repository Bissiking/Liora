// src/shared/places.ts
export type PlaceSearchItem = {
  id: string;
  category: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_m?: number;
};
export type PlaceSearchResponse = {
  data: PlaceSearchItem[];
  area: { label: string; latitude: number; longitude: number } | null;
};
