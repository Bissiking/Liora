// tests/place-search.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { PlaceSearch } from "../src/server/place-search.js";
import {
  photonFixture,
  photonRestaurants,
  photonFreePlaces,
} from "./fixtures/places.js";
import { HttpError } from "../src/server/errors.js";
function mocked(data: unknown = photonFixture) {
  const calls: { url: URL; init?: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    return Response.json(data);
  };
  return {
    service: new PlaceSearch({
      fetcher,
      geocoderUrl: "https://geocoder.test/api",
      appUrl: "https://liora.test",
      intervalMs: 0,
    }),
    calls,
  };
}
test("free search preserves cities and does not replace them with Burger King", async () => {
  const { service, calls } = mocked();
  const r = await service.search("Rennes", 46.6, 2.4);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("q"), "Rennes");
  assert.equal(calls[0].url.searchParams.get("limit"), "20");
  assert.equal(calls[0].url.searchParams.get("lang"), "fr");
  assert.equal(
    new Headers(calls[0].init?.headers).get("Referer"),
    "https://liora.test",
  );
  assert.equal(r.data[0].name, "Rennes");
  assert.equal(r.data[0].category, "place");
});
test("free search coalesces and caches equivalent aliases separately from nearby mode", async () => {
  const { service, calls } = mocked(photonFreePlaces);
  const [a, b] = await Promise.all([
    service.search("MacDo", 48.1, -1.6),
    service.search("mcdo", 48.1, -1.6),
  ]);
  assert.deepEqual(a, b);
  assert.equal(calls.length, 1);
  assert.deepEqual(await service.search("McDonalds", 48.1, -1.6), a);
  assert.equal(calls.length, 1);
  await service.search("MacDo", 48.1, -1.6, true);
  assert.equal(calls.length, 2);
});
test("free search retains restaurants, campsites and museums in provider relevance order", async () => {
  const { service, calls } = mocked(photonFreePlaces);
  const r = await service.search("lieux Rennes", 48.1, -1.6);
  assert.equal(calls[0].url.searchParams.get("q"), "lieux Rennes");
  assert.deepEqual(
    r.data.map((p) => p.name),
    photonFreePlaces.features.map((f) => f.properties.name),
  );
  assert.ok(r.data.every((p) => p.category === "place"));
  assert.equal(r.data[0].address, "3 Rue de l’Alma, 35000 Rennes, France");
});
test("nearby searches use the selected centre, sort by distance and exclude distant matches", async () => {
  const direct = structuredClone(photonFreePlaces);
  direct.features.push({
    ...direct.features[0],
    geometry: { type: "Point", coordinates: [13.4, 52.5] },
  });
  const { service, calls } = mocked(direct);
  const r = await service.search("MacDo", 48.1, -1.6, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("q"), "McDonald's");
  assert.equal(calls[0].url.searchParams.get("lat"), "48.1");
  assert.equal(calls[0].url.searchParams.get("location_bias_scale"), "0");
  assert.equal(r.area?.label, "la zone affichée");
  assert.equal(r.data.length, 3);
  assert.ok(r.data.every((p) => p.distance_m! <= 15000));
  assert.ok(r.data[0].distance_m! <= r.data[1].distance_m!);
});
test("unknown searches stay empty rather than falling back to another brand", async () => {
  const { service, calls } = mocked({ features: [] });
  assert.deepEqual(await service.search("Introuvable", 48.1, -1.6), {
    data: [],
    area: null,
  });
  assert.equal(calls.length, 1);
});
test("places search rejects invalid coordinates and incomplete provider answers", async () => {
  const bad = structuredClone(photonFixture);
  bad.features[0].geometry.coordinates = [1000, 1000];
  for (const data of [bad, { invalid: true }])
    await assert.rejects(
      mocked(data).service.search("Rennes", 48.1, -1.6),
      (e: unknown) => e instanceof HttpError && e.status === 503,
    );
});
test("provider failures are recoverable and throttling triggers a shared cooldown", async () => {
  let calls = 0;
  const service = new PlaceSearch({
    intervalMs: 0,
    fetcher: async () => {
      calls++;
      return new Response("", { status: 429 });
    },
  });
  await assert.rejects(
    service.search("Rennes", 48.1, -1.6),
    (e: unknown) =>
      e instanceof HttpError && e.code === "PLACE_SEARCH_UNAVAILABLE",
  );
  await assert.rejects(
    service.search("Nantes", 48.1, -1.6),
    (e: unknown) =>
      e instanceof HttpError && e.code === "PLACE_SEARCH_COOLDOWN",
  );
  assert.equal(calls, 1);
});
test("named places preserve their query, distant relevant results and legacy Burger King category", async () => {
  const direct = structuredClone(photonRestaurants);
  direct.features.push({
    ...direct.features[0],
    geometry: { type: "Point", coordinates: [13.4, 52.5] },
  });
  const { service, calls } = mocked(direct);
  const r = await service.search("Burger King Rennes Alma", 48.1, -1.6);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("q"), "Burger King Rennes Alma");
  assert.equal(r.data.length, 4);
  assert.equal(r.data[0].category, "burger-king");
  assert.equal(r.data[2].category, "place");
  assert.ok(r.data.some((p) => p.distance_m! > 15000));
});
test("unnamed street addresses remain selectable and duplicate points are collapsed", async () => {
  const f = {
    geometry: { type: "Point", coordinates: [-1.6, 48.1] },
    properties: {
      housenumber: "12",
      street: "Rue du Test",
      city: "Rennes",
      osm_type: "N",
      osm_id: 5001,
    },
  };
  const { service } = mocked({ features: [f, f] });
  const r = await service.search("12 rue du Test", 48.1, -1.6);
  assert.equal(r.data.length, 1);
  assert.equal(r.data[0].name, "12 Rue du Test");
  assert.equal(r.data[0].category, "place");
});
