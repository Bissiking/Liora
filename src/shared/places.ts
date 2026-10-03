// src/shared/places.ts
export const categoryForPlaceName = (name: string) =>
  /\bburger\s*king\b/i.test(name) ? "burger-king" : "place";
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
