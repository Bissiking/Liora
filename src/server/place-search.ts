// src/server/place-search.ts
import { z } from "zod";
import { HttpError } from "./errors.js";
import { VERSION } from "../shared/version.js";
import type { PlaceSearchItem, PlaceSearchResponse } from "../shared/places.js";
const photon = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal("Point"),
          coordinates: z.tuple([
            z.number().min(-180).max(180),
            z.number().min(-85).max(85),
          ]),
        }),
        properties: z.record(z.string(), z.unknown()),
      }),
    )
    .max(100),
});
type Feature = z.infer<typeof photon>["features"][number];
const burger = /\bburger\s*king\b/i;
const text = (v: unknown) => (typeof v === "string" ? v : "");
function address(p: Record<string, unknown>) {
  const street = [text(p.housenumber), text(p.street)]
    .filter(Boolean)
    .join(" ");
  const city =
    text(p.city) || text(p.town) || text(p.village) || text(p.locality);
  return [
    street,
    [text(p.postcode), city].filter(Boolean).join(" "),
    text(p.country),
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 300);
}
function distance(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180,
    dLat = (b.latitude - a.latitude) * rad,
    dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h))));
}
// Only explicit user searches reach Photon. Shared caching, request coalescing and
// one bounded request at a time keep demo-service traffic modest. No background scan.
export class PlaceSearch {
  private cache = new Map<
    string,
    { until: number; result: PlaceSearchResponse }
  >();
  private flights = new Map<string, Promise<PlaceSearchResponse>>();
  private queue = Promise.resolve();
  private pending = 0;
  private nextRequest = 0;
  constructor(
    private options: {
      fetcher?: typeof fetch;
      geocoderUrl?: string;
      appUrl?: string;
      intervalMs?: number;
    } = {},
  ) {}
  private async lookup(
    query: string,
    center: { latitude: number; longitude: number },
    nearby = false,
  ) {
    if (this.pending >= 8)
      throw new HttpError(
        429,
        "PLACE_SEARCH_BUSY",
        "La recherche est occupée. Réessayez dans quelques instants.",
      );
    this.pending++;
    const queuedAt = Date.now();
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      if (Date.now() - queuedAt > 5000)
        throw new HttpError(
          429,
          "PLACE_SEARCH_BUSY",
          "La recherche est occupée. Réessayez dans quelques instants.",
        );
      if (this.nextRequest - Date.now() > 1500)
        throw new HttpError(
          429,
          "PLACE_SEARCH_COOLDOWN",
          "Le service de recherche demande une pause. Réessayez dans trente secondes.",
        );
      await new Promise((r) =>
        setTimeout(r, Math.max(0, this.nextRequest - Date.now())),
      );
      this.nextRequest = Date.now() + (this.options.intervalMs ?? 1100);
      const url = new URL(
        this.options.geocoderUrl ||
          process.env.PLACES_GEOCODER_URL ||
          "https://photon.komoot.io/api/",
      );
      url.searchParams.set("q", query);
      url.searchParams.set("lang", "fr");
      url.searchParams.set("limit", "20");
      url.searchParams.set("lat", String(center.latitude));
      url.searchParams.set("lon", String(center.longitude));
      if (nearby) {
        url.searchParams.set("zoom", "12");
        url.searchParams.set("location_bias_scale", "0");
      }
      const origin = new URL(
        this.options.appUrl || process.env.APP_URL || "http://localhost:4310",
      ).origin;
      const response = await (this.options.fetcher || fetch)(url, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent": `Liora/${VERSION} (${origin}; place search)`,
          Referer: origin,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        if ([429, 503].includes(response.status))
          this.nextRequest = Date.now() + 30000;
        await response.body?.cancel();
        throw Error("provider unavailable");
      }
      const reader = response.body?.getReader();
      if (!reader) throw Error("empty response");
      let size = 0;
      const chunks: Uint8Array[] = [];
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 2_000_000) throw Error("response too large");
          chunks.push(part.value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const parsed = photon.safeParse(
        JSON.parse(Buffer.concat(chunks).toString("utf8")),
      );
      if (!parsed.success) throw Error("invalid response");
      return parsed.data.features;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(
        503,
        "PLACE_SEARCH_UNAVAILABLE",
        "La recherche de lieux est momentanément indisponible. Réessayez ou placez le lieu sur la carte.",
      );
    } finally {
      this.pending--;
      release();
    }
  }
  async search(
    query: string,
    latitude: number,
    longitude: number,
    nearby = false,
  ): Promise<PlaceSearchResponse> {
    const q = (query.trim() || "restaurant")
        .replace(/\s+/g, " ")
        .replace(/\b(?:macdo|mcdo|mcdonalds)\b/gi, "McDonald's"),
      point = {
        latitude: Number(latitude.toFixed(2)),
        longitude: Number(longitude.toFixed(2)),
      };
    const key = JSON.stringify([
      q.toLocaleLowerCase(),
      point.latitude,
      point.longitude,
      nearby,
    ]);
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return cached.result;
    const flight = this.flights.get(key);
    if (flight) return flight;
    const work = this.run(q, point, nearby)
      .then((result) => {
        if (this.cache.size >= 256)
          this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { until: Date.now() + 600000, result });
        return result;
      })
      .finally(() => {
        this.flights.delete(key);
      });
    this.flights.set(key, work);
    return work;
  }
  private async run(
    q: string,
    point: { latitude: number; longitude: number },
    nearby: boolean,
  ): Promise<PlaceSearchResponse> {
    const features = await this.lookup(q, point, nearby);
    if (!features.length)
      return {
        data: [],
        area: nearby ? { ...point, label: "la zone affichée" } : null,
      };
    let area = { ...point, label: "la zone affichée" };
    if (!nearby) {
      const first = features[0],
        p = first.properties;
      area = {
        latitude: first.geometry.coordinates[1],
        longitude: first.geometry.coordinates[0],
        label:
          [text(p.name), address(p)].filter(Boolean).join(", ").slice(0, 300) ||
          q,
      };
    }
    const unique = new Map<string, PlaceSearchItem>();
    for (const f of features) {
      const name =
        text(f.properties.name) ||
        [text(f.properties.housenumber), text(f.properties.street)]
          .filter(Boolean)
          .join(" ") ||
        address(f.properties) ||
        "Lieu sans nom";
      const p = {
        id: `osm:${text(f.properties.osm_type)}:${f.properties.osm_id}`,
        category: burger.test(name) ? "burger-king" : "place",
        name: name.slice(0, 120),
        address:
          address(f.properties) || `À proximité de ${area.label}`.slice(0, 300),
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
      };
      const metres = distance(area, p);
      if (nearby && metres > 15000) continue;
      unique.set(`${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`, {
        ...p,
        distance_m: metres,
      });
    }
    return {
      data: (nearby
        ? [...unique.values()].sort((a, b) => a.distance_m! - b.distance_m!)
        : [...unique.values()]
      ).slice(0, 20),
      area,
    };
  }
}
