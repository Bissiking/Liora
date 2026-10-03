// tests/fixtures/places.ts
import { createServer } from "node:http";
export const photonFixture = {
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-1.6778, 48.1173] },
      properties: {
        name: "Rennes",
        city: "Rennes",
        country: "France",
        osm_key: "place",
        osm_value: "city",
        osm_type: "R",
        osm_id: 2001,
      },
    },
  ],
};
export const photonRestaurants = {
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-1.679, 48.086] },
      properties: {
        name: "Burger King Rennes Alma · test",
        osm_key: "amenity",
        osm_value: "fast_food",
        osm_type: "N",
        osm_id: 3001,
        housenumber: "3",
        street: "Rue de l’Alma",
        postcode: "35000",
        city: "Rennes",
        country: "France",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-1.61, 48.12] },
      properties: {
        name: "Burger King Cesson · test",
        osm_key: "amenity",
        osm_value: "fast_food",
        osm_type: "W",
        osm_id: 3002,
        street: "Route de Rennes",
        city: "Cesson-Sévigné",
        country: "France",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-1.65, 48.12] },
      properties: {
        name: "Restaurant de test",
        osm_key: "amenity",
        osm_value: "restaurant",
        osm_type: "N",
        osm_id: 3003,
        country: "France",
      },
    },
  ],
};
export const photonFreePlaces = {
  features: [
    {
      ...photonRestaurants.features[0],
      properties: {
        ...photonRestaurants.features[0].properties,
        name: "McDonald's Rennes · test",
        osm_id: 4001,
      },
    },
    {
      ...photonRestaurants.features[1],
      properties: {
        ...photonRestaurants.features[1].properties,
        name: "Camping des étoiles · test",
        osm_key: "tourism",
        osm_value: "camp_site",
        osm_id: 4002,
      },
    },
    {
      ...photonRestaurants.features[2],
      properties: {
        ...photonRestaurants.features[2].properties,
        name: "Musée de test",
        osm_key: "tourism",
        osm_value: "museum",
        osm_id: 4003,
      },
    },
  ],
};
export async function fixturePlaces(port: number) {
  const calls: { path: string; query: string }[] = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url!, `http://127.0.0.1:${port}`),
      q = url.searchParams.get("q") || "";
    calls.push({ path: url.pathname, query: q });
    res.setHeader("Content-Type", "application/json");
    if (url.pathname === "/photon")
      res.end(
        JSON.stringify(
          q.includes("Introuvable")
            ? { features: [] }
            : /burger\s*king/i.test(q)
              ? photonRestaurants
              : /mcdonald|camping|musée|restaurant/i.test(q)
                ? {
                    features: photonFreePlaces.features.filter(
                      (f) =>
                        /restaurant/i.test(q) ||
                        (/mcdonald/i.test(q)
                          ? /mcdonald/i.test(f.properties.name)
                          : /camping/i.test(q)
                            ? /camping/i.test(f.properties.name)
                            : /musée/i.test(f.properties.name)),
                    ),
                  }
                : photonFixture,
        ),
      );
    else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(port, "127.0.0.1", resolve),
  );
  return {
    server,
    calls,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((e) => (e ? reject(e) : resolve())),
      ),
  };
}
