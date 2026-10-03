// src/client/Places.tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./places.css";
import {
  MapPin,
  Plus,
  LocateFixed,
  Check,
  Bookmark,
  Users,
  ArrowLeft,
  Search,
  X,
} from "lucide-react";
import { api } from "./api";
import { Avatar, Empty } from "./ui";
import { HelpHint } from "./HelpHint";
import type { PlaceSearchItem, PlaceSearchResponse } from "../shared/places";
import { categoryForPlaceName } from "../shared/places";
type Place = PlaceSearchItem & {
  state?: "wishlist" | "visited";
  visibility?: string;
  visited_on?: string | null;
  notes?: string;
};
type Visitor = { id: string; name: string; avatar?: string };
type Editor = {
  place?: Place;
  category: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  state: "wishlist" | "visited";
  visited_on: string;
  notes: string;
  visibility: string;
};
const initial = [46.6, 2.4] as [number, number];
const external = (p: Place) => p.id.startsWith("osm:");
const coordinateKey = (p: Pick<Place, "latitude" | "longitude">) =>
  `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
function editorFor(p?: Place): Editor {
  return {
    place: p,
    category: p?.category || "place",
    name: p?.name || "",
    address: p?.address || "",
    latitude: p ? String(p.latitude) : "",
    longitude: p ? String(p.longitude) : "",
    state: p?.state || "wishlist",
    visited_on: p?.visited_on?.slice(0, 10) || "",
    notes: p?.notes || "",
    visibility: p?.visibility || "private",
  };
}
function markerIcon(state?: string) {
  const symbol =
    state === "visited"
      ? '<path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/>'
      : state === "wishlist"
        ? '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>'
        : '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>';
  return L.divIcon({
    className: `place-marker ${state || "unmarked"}`,
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${symbol}</svg>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}
export function Places() {
  const element = useRef<HTMLDivElement>(null),
    index = useRef<HTMLElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null),
    pinMarker = useRef<L.Marker | null>(null),
    openRef = useRef<(p: Place) => void>(() => {}),
    adding = useRef(false),
    request = useRef(0),
    searchRequest = useRef(0),
    lastSearch = useRef<{
      q: string;
      center?: { latitude: number; longitude: number };
      nearby?: boolean;
    }>({ q: "" });
  const [visible, setVisible] = useState<Place[]>([]),
    [mine, setMine] = useState<Place[]>([]),
    [selected, setSelected] = useState<Place | null>(null),
    [visitors, setVisitors] = useState<Visitor[]>([]),
    [categories, setCategories] = useState<{ key: string; name: string }[]>([]),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [collectionQuery, setCollectionQuery] = useState(""),
    [results, setResults] = useState<PlaceSearchResponse | null>(null),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState("");
  adding.current = !!editor && !editor.place;
  const point =
    editor &&
    editor.latitude !== "" &&
    editor.longitude !== "" &&
    Number.isFinite(Number(editor.latitude)) &&
    Number.isFinite(Number(editor.longitude)) &&
    Math.abs(Number(editor.latitude)) <= 85 &&
    Math.abs(Number(editor.longitude)) <= 180
      ? {
          latitude: Number(editor.latitude),
          longitude: Number(editor.longitude),
        }
      : null;
  function showPanel() {
    if (window.matchMedia("(max-width:760px)").matches)
      requestAnimationFrame(() =>
        index.current?.scrollIntoView({ block: "start" }),
      );
  }
  function resolved(p: Place): Place {
    return external(p)
      ? mine.find(
          (s) =>
            s.category === p.category && coordinateKey(s) === coordinateKey(p),
        ) ||
          visible.find(
            (s) =>
              s.category === p.category &&
              coordinateKey(s) === coordinateKey(p),
          ) ||
          p
      : p;
  }
  function open(p: Place) {
    setSelected(resolved(p));
    setEditor(null);
    setSaved("");
    setError("");
    showPanel();
  }
  openRef.current = open;
  async function load() {
    const seq = ++request.current,
      bounds = map.current?.getBounds();
    if (!bounds) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        south: String(Math.max(-85, bounds.getSouth())),
        north: String(Math.min(85, bounds.getNorth())),
        west: String(((((bounds.getWest() + 180) % 360) + 360) % 360) - 180),
        east: String(((((bounds.getEast() + 180) % 360) + 360) % 360) - 180),
      });
      if (bounds.getEast() - bounds.getWest() >= 360) {
        params.set("west", "-180");
        params.set("east", "180");
      }
      const [r, m] = await Promise.all([
        api<{ data: Place[]; nextCursor: string | null }>(
          `/api/v1/places?${params}`,
        ),
        api<{ data: Place[] }>("/api/v1/places/mine"),
      ]);
      if (seq !== request.current) return;
      setVisible(r.data);
      setMine(m.data);
      setMore(!!r.nextCursor);
      setSelected((old) =>
        old
          ? m.data.find((p) => p.id === old.id) ||
            r.data.find((p) => p.id === old.id) ||
            (external(old)
              ? old
              : {
                  ...old,
                  state: undefined,
                  notes: "",
                  visibility: "private",
                  visited_on: null,
                })
          : null,
      );
    } catch (e) {
      if (seq === request.current) setError((e as Error).message);
    } finally {
      if (seq === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, {
      worldCopyJump: true,
      // Leaflet 1.9 can complete a zoom after route teardown; keep zoom changes synchronous.
      zoomAnimation: false,
      minZoom: 2,
      maxZoom: 19,
    }).setView(initial, 6);
    map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    let timer: ReturnType<typeof setTimeout>;
    instance.on("moveend", () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 300);
    });
    instance.on("click", (e: L.LeafletMouseEvent) => {
      if (adding.current) {
        setEditor((old) =>
          old
            ? {
                ...old,
                latitude: e.latlng.lat.toFixed(6),
                longitude: L.Util.wrapNum(e.latlng.lng, [-180, 180]).toFixed(6),
              }
            : null,
        );
        showPanel();
      }
    });
    void load();
    void api<{ data: { key: string; name: string }[] }>(
      "/api/v1/places/categories",
    )
      .then((r) => setCategories(r.data))
      .catch((e) => setError(e.message));
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(element.current);
    return () => {
      request.current++;
      searchRequest.current++;
      clearTimeout(timer);
      observer.disconnect();
      instance.remove();
      map.current = null;
      pinMarker.current = null;
    };
  }, []);
  useEffect(() => {
    const layer = markers.current;
    if (!layer) return;
    layer.clearLayers();
    const all = [
      ...visible,
      ...mine,
      ...(filter === "search" ? results?.data.map(resolved) || [] : []),
    ];
    for (const p of new Map(all.map((p) => [coordinateKey(p), p])).values()) {
      const marker = L.marker([p.latitude, p.longitude], {
        icon: markerIcon(p.state),
        title: p.name,
        keyboard: true,
      }).addTo(layer);
      marker
        .getElement()
        ?.setAttribute(
          "aria-label",
          `${p.name} · ${p.state === "visited" ? "Visité" : p.state === "wishlist" ? "À essayer" : "Lieu"}`,
        );
      marker.on("click", () => {
        if (!adding.current) openRef.current(p);
      });
      const tip = document.createElement("span");
      tip.textContent = p.name;
      marker.bindTooltip(tip);
    }
  }, [visible, mine, results, filter]);
  useEffect(() => {
    pinMarker.current?.remove();
    pinMarker.current = null;
    if (!point || !editor || editor.place || !map.current) return;
    const pin = L.marker([point.latitude, point.longitude], {
      icon: markerIcon("wishlist"),
      draggable: true,
      title: "Emplacement du nouveau lieu",
    }).addTo(map.current);
    pin
      .getElement()
      ?.setAttribute(
        "aria-label",
        "Emplacement du nouveau lieu, déplaçable sur la carte",
      );
    pin.on("dragend", () => {
      const p = pin.getLatLng();
      setEditor((old) =>
        old
          ? {
              ...old,
              latitude: p.lat.toFixed(6),
              longitude: L.Util.wrapNum(p.lng, [-180, 180]).toFixed(6),
            }
          : null,
      );
    });
    pinMarker.current = pin;
  }, [editor?.place?.id, editor?.latitude, editor?.longitude]);
  useEffect(() => {
    let gone = false;
    setVisitors([]);
    if (selected && !external(selected))
      void api<{ data: Visitor[] }>(`/api/v1/places/${selected.id}/visitors`)
        .then((r) => {
          if (!gone) setVisitors(r.data);
        })
        .catch((e) => {
          if (!gone) setError(e.message);
        });
    return () => {
      gone = true;
    };
  }, [selected?.id, selected?.visibility, selected?.state]);
  async function search(
    q = query,
    center?: { latitude: number; longitude: number },
    nearby = false,
  ) {
    if (searching || editor) return;
    const seq = ++searchRequest.current,
      c = map.current?.getCenter(),
      location = center || {
        latitude: c?.lat ?? initial[0],
        longitude: c ? L.Util.wrapNum(c.lng, [-180, 180]) : initial[1],
      };
    setSearching(true);
    lastSearch.current = { q, center: location, nearby };
    setSearchError("");
    setResults(null);
    setSelected(null);
    setFilter("search");
    setSaved("");
    showPanel();
    try {
      const params = new URLSearchParams({
        q,
        latitude: String(Math.max(-85, Math.min(85, location.latitude))),
        longitude: String(location.longitude),
      });
      if (nearby) params.set("nearby", "1");
      const r = await api<PlaceSearchResponse>(
        `/api/v1/places/search?${params}`,
      );
      if (seq !== searchRequest.current) return;
      setResults(r);
      if (r.data.length)
        map.current?.fitBounds(
          L.latLngBounds(
            r.data.map((p) => [p.latitude, p.longitude] as [number, number]),
          ),
          { padding: [40, 40], maxZoom: 15 },
        );
      else if (r.area)
        map.current?.setView([r.area.latitude, r.area.longitude], 13);
    } catch (e) {
      if (seq === searchRequest.current) setSearchError((e as Error).message);
    } finally {
      if (seq === searchRequest.current) setSearching(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) {
      setError(
        "La localisation n’est pas disponible. Recherchez une ville ou déplacez la carte.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const center = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        };
        map.current?.setView([center.latitude, center.longitude], 13);
        void search(query.trim() || "restaurant", center, true);
      },
      (e) =>
        setError(
          e.code === 1
            ? "Localisation refusée. Recherchez une ville ou une adresse."
            : "Votre position n’a pas pu être déterminée.",
        ),
      { timeout: 10000 },
    );
  }
  async function savePlace(
    p: Place,
    value: {
      state: string;
      visibility: string;
      visited_on: string | null;
      notes: string;
    },
  ) {
    let place = p;
    if (external(p)) {
      const r = await api<{ data: Place }>("/api/v1/places", "POST", {
        category: p.category,
        name: p.name,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        entry: value,
      });
      place = r.data;
    } else await api(`/api/v1/places/${p.id}/entry`, "PUT", value);
    setSelected({ ...place, ...value, state: value.state as Place["state"] });
    await load();
  }
  async function quickSave(state: "wishlist" | "visited") {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await savePlace(selected, {
        state,
        notes: selected.notes || "",
        visibility: selected.visibility || "private",
        visited_on:
          state === "visited"
            ? selected.visited_on?.slice(0, 10) || null
            : null,
      });
      setSaved(
        state === "visited"
          ? "Visite enregistrée. Visible uniquement selon votre choix de partage."
          : "Ajouté aux lieux à essayer.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function saveEditor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor || saving) return;
    setSaving(true);
    setError("");
    const value = {
      state: editor.state,
      visibility: editor.visibility,
      notes: editor.notes,
      visited_on: editor.state === "visited" ? editor.visited_on || null : null,
    };
    try {
      if (editor.place) await savePlace(editor.place, value);
      else {
        if (!point) throw Error("Placez d’abord un point sur la carte.");
        const r = await api<{ data: Place }>("/api/v1/places", "POST", {
          category: categoryForPlaceName(editor.name),
          name: editor.name,
          address: editor.address,
          ...point,
          entry: value,
        });
        setSelected({ ...r.data, ...value, state: editor.state });
        map.current?.setView([point.latitude, point.longitude], 15);
        await load();
      }
      setEditor(null);
      setSaved("Votre suivi est enregistré.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function manual() {
    searchRequest.current++;
    setSearching(false);
    setEditor(editorFor());
    setSelected(null);
    setError("");
    setSaved("");
    showPanel();
  }
  function chooseFilter(id: string) {
    if (saving) return;
    searchRequest.current++;
    setSearching(false);
    setFilter(id);
    if (id !== "search") setSearchError("");
    setSelected(null);
    setEditor(null);
    setSaved("");
  }
  const list = (
    filter === "search"
      ? results?.data.map(resolved) || []
      : filter === "nearby"
        ? visible
        : mine
  ).filter(
    (p) =>
      ((filter !== "wishlist" && filter !== "visited") || p.state === filter) &&
      (filter === "search" ||
        `${p.name} ${p.address}`
          .toLocaleLowerCase()
          .includes(collectionQuery.toLocaleLowerCase())),
  );
  return (
    <div className="page places-page">
      <header className="page-heading">
        <div>
          <h1>Mes lieux</h1>
          <p>Trouvez vos lieux. Gardez vos envies et vos visites.</p>
        </div>
        <button onClick={manual} disabled={saving || !!editor}>
          <Plus size={16} />
          Ajouter manuellement
        </button>
      </header>
      <form
        className="place-discovery"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(searchInput.current?.value || query);
        }}
      >
        <label htmlFor="place-discovery-query">Où voulez-vous aller ?</label>
        <div className="place-discovery-input">
          <Search size={20} />
          <input
            id="place-discovery-query"
            ref={searchInput}
            placeholder="MacDo, camping, musée, adresse…"
            value={query}
            maxLength={120}
            disabled={!!editor}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="icon"
              aria-label="Effacer la recherche de lieux"
              disabled={!!editor}
              onClick={() => {
                setQuery("");
                searchInput.current?.focus();
              }}
            >
              <X size={17} />
            </button>
          )}
          <button
            className="primary"
            disabled={searching || !!editor || !query.trim()}
          >
            {searching ? "Recherche…" : "Rechercher"}
          </button>
        </div>
        <p>
          Recherchez un lieu, une enseigne ou une adresse, ou cherchez{" "}
          <button
            type="button"
            className="text-action"
            onClick={locate}
            disabled={searching || !!editor}
          >
            <LocateFixed size={14} />
            autour de moi
          </button>
          .
        </p>
      </form>
      <HelpHint title="Comment ajouter un lieu sans coordonnées ?">
        Recherchez une enseigne, un camping, un musée, une ville ou une adresse.
        Choisissez un lieu et marquez-le À essayer ou Visité. Ajoutez une ville
        au nom pour préciser la recherche, par exemple « MacDo Rennes ». Les
        actions Autour de moi et Rechercher dans cette zone cherchent votre
        texte dans un rayon de 15 km ; sans texte, elles cherchent des
        restaurants. Pour un lieu manquant, utilisez Ajouter manuellement puis
        cliquez sur la carte. Vos notes restent privées et le partage des
        visites est facultatif. La recherche utilise des données OpenStreetMap ;
        seules votre recherche et la zone choisie sont transmises aux services
        de recherche.
      </HelpHint>
      {error && !editor && !selected && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="places-toolbar">
        <div className="segmented" aria-label="Collection de lieux">
          {(results || filter === "search" ? [["search", "Résultats"]] : [])
            .concat([
              ["all", "Ma collection"],
              ["wishlist", "À essayer"],
              ["visited", "Visités"],
              ["nearby", "Sur la carte"],
            ])
            .map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id && !editor}
                onClick={() => chooseFilter(id)}
                disabled={saving || !!editor}
              >
                {label}
                {id === "wishlist" || id === "visited"
                  ? ` · ${mine.filter((p) => p.state === id).length}`
                  : ""}
              </button>
            ))}
        </div>
      </div>
      <div
        className={`places-layout ${selected || editor || filter === "search" ? "has-panel" : ""} ${editor && !editor.place ? "placing-point" : ""}`}
      >
        <section className="places-map-area" aria-label="Carte géographique">
          <div className="places-map" ref={element} />
          {editor && !editor.place && (
            <p className="place-map-prompt">
              <MapPin size={16} />
              {point
                ? "Déplacez le point pour ajuster l’emplacement."
                : "Cliquez sur la carte pour placer le lieu."}
            </p>
          )}
          <div className="map-actions">
            {editor && !editor.place && (
              <button
                onClick={() => {
                  const p = map.current?.getCenter();
                  if (p)
                    setEditor({
                      ...editor,
                      latitude: p.lat.toFixed(6),
                      longitude: L.Util.wrapNum(p.lng, [-180, 180]).toFixed(6),
                    });
                  showPanel();
                }}
              >
                Placer au centre de la carte
              </button>
            )}
            <button
              disabled={searching || !!editor}
              onClick={() =>
                void search(query.trim() || "restaurant", undefined, true)
              }
            >
              Rechercher dans cette zone
            </button>
            <button
              aria-label="Centrer sur mes lieux"
              disabled={!mine.length}
              onClick={() => {
                if (mine.length)
                  map.current?.fitBounds(
                    L.latLngBounds(
                      mine.map(
                        (p) => [p.latitude, p.longitude] as [number, number],
                      ),
                    ),
                    { padding: [35, 35], maxZoom: 15 },
                  );
              }}
            >
              Ma collection
            </button>
          </div>
        </section>
        <aside
          className="places-index"
          ref={index}
          aria-label={
            editor
              ? "Ajout ou modification du lieu"
              : selected
                ? "Détail du lieu"
                : "Liste des lieux"
          }
        >
          {error && (editor || selected) && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {editor ? (
            <form className="place-editor" onSubmit={saveEditor}>
              <button
                className="text-action"
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditor(null);
                  setError("");
                }}
              >
                <ArrowLeft size={16} />
                Annuler
              </button>
              <h2>{editor.place ? "Mon suivi" : "Ajouter un lieu"}</h2>
              {editor.place ? (
                <>
                  <strong>{editor.name}</strong>
                  <p>{editor.address}</p>
                </>
              ) : (
                <>
                  <div className={`place-position ${point ? "ready" : ""}`}>
                    <MapPin size={20} />
                    <span>
                      <strong>
                        {point
                          ? "Emplacement choisi"
                          : "Choisissez l’emplacement"}
                      </strong>
                      <small>
                        {point
                          ? "Le point est visible et déplaçable sur la carte."
                          : "Placez un point en cliquant sur la carte."}
                      </small>
                    </span>
                  </div>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => {
                      element.current?.scrollIntoView({ block: "center" });
                      map.current?.getContainer().focus();
                    }}
                  >
                    {point ? "Ajuster sur la carte" : "Placer sur la carte"}
                  </button>
                  <label>
                    Nom du lieu
                    <input
                      name="name"
                      placeholder="Restaurant, camping, musée…"
                      required
                      maxLength={120}
                      value={editor.name}
                      onChange={(e) =>
                        setEditor({ ...editor, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>
                      Adresse ou ville <small>facultatif</small>
                    </span>
                    <input
                      name="address"
                      placeholder="Rue, quartier ou ville"
                      maxLength={300}
                      value={editor.address}
                      onChange={(e) =>
                        setEditor({ ...editor, address: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              <fieldset className="place-state-choice">
                <legend>Dans ma collection</legend>
                <div className="segmented">
                  {(
                    [
                      ["wishlist", "À essayer"],
                      ["visited", "Visité"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={editor.state === value}
                      onClick={() => setEditor({ ...editor, state: value })}
                    >
                      {value === "visited" ? (
                        <Check size={16} />
                      ) : (
                        <Bookmark size={16} />
                      )}{" "}
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
              {editor.state === "visited" && (
                <label>
                  <span>
                    Date de visite <small>facultatif</small>
                  </span>
                  <input
                    name="visited_on"
                    type="date"
                    value={editor.visited_on}
                    onChange={(e) =>
                      setEditor({ ...editor, visited_on: e.target.value })
                    }
                  />
                </label>
              )}
              <details className="place-extra">
                <summary>Notes et partage</summary>
                <label>
                  Mes notes privées
                  <textarea
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    value={editor.notes}
                    onChange={(e) =>
                      setEditor({ ...editor, notes: e.target.value })
                    }
                  />
                </label>
                <label>
                  Qui peut voir mes visites ?
                  <select
                    name="visibility"
                    value={editor.visibility}
                    onChange={(e) =>
                      setEditor({ ...editor, visibility: e.target.value })
                    }
                  >
                    <option value="private">Moi uniquement</option>
                    <option value="friends">Mes amis</option>
                    <option value="community">Tous les membres de Liora</option>
                  </select>
                </label>
                <p>
                  Les notes restent privées, même si vous partagez vos visites.
                </p>
              </details>
              {!editor.place && (
                <details className="place-extra">
                  <summary>Coordonnées avancées</summary>
                  <p>
                    Optionnel : utilisez ces champs seulement si vous connaissez
                    déjà la position exacte.
                  </p>
                  <label>
                    Latitude
                    <input
                      name="latitude"
                      type="number"
                      step="any"
                      min="-85"
                      max="85"
                      value={editor.latitude}
                      onChange={(e) =>
                        setEditor({ ...editor, latitude: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Longitude
                    <input
                      name="longitude"
                      type="number"
                      step="any"
                      min="-180"
                      max="180"
                      value={editor.longitude}
                      onChange={(e) =>
                        setEditor({ ...editor, longitude: e.target.value })
                      }
                    />
                  </label>
                </details>
              )}
              <div className="place-editor-footer">
                <small className="place-privacy">
                  {editor.visibility === "private"
                    ? "Suivi privé par défaut."
                    : editor.visibility === "friends"
                      ? "Vos visites seront visibles par vos amis."
                      : "Vos visites seront visibles par les membres de Liora."}
                </small>
                <button
                  className="primary"
                  disabled={
                    saving || (!editor.place && (!point || !editor.name.trim()))
                  }
                >
                  {saving
                    ? "Enregistrement…"
                    : editor.place
                      ? "Enregistrer"
                      : "Ajouter à ma collection"}
                </button>
              </div>
            </form>
          ) : selected ? (
            <>
              <button
                className="text-action"
                disabled={saving}
                onClick={() => {
                  setSelected(null);
                  setSaved("");
                }}
              >
                <ArrowLeft size={16} />
                {filter === "search" ? "Les résultats" : "Ma liste"}
              </button>
              <h2>{selected.name}</h2>
              <p>{selected.address || "Adresse non renseignée"}</p>
              <div className="place-quick-actions">
                {(
                  [
                    ["wishlist", "À essayer"],
                    ["visited", "Visité"],
                  ] as const
                ).map(([state, label]) => (
                  <button
                    key={state}
                    className={selected.state === state ? "selected" : ""}
                    aria-pressed={selected.state === state}
                    disabled={saving || selected.state === state}
                    onClick={() => void quickSave(state)}
                  >
                    {state === "visited" ? (
                      <Check size={18} />
                    ) : (
                      <Bookmark size={18} />
                    )}{" "}
                    {label}
                  </button>
                ))}
              </div>
              {saving && <p role="status">Enregistrement…</p>}
              {saved && (
                <p className="place-saved" role="status">
                  {saved}
                </p>
              )}
              {selected.visited_on && (
                <p>
                  Visité le{" "}
                  {new Date(
                    `${selected.visited_on.slice(0, 10)}T12:00`,
                  ).toLocaleDateString("fr-FR")}
                </p>
              )}
              <small className="place-privacy">
                {selected.visibility === "friends"
                  ? "Visites visibles par vos amis."
                  : selected.visibility === "community"
                    ? "Visites visibles par les membres de Liora."
                    : "Votre suivi reste privé."}
              </small>
              <button
                className="text-action"
                disabled={saving}
                onClick={() => {
                  setEditor(editorFor(selected));
                  setSaved("");
                  setError("");
                }}
              >
                Notes, date et partage
              </button>
              {selected.notes && (
                <section>
                  <h3>Mes notes privées</h3>
                  <p className="private-notes">{selected.notes}</p>
                </section>
              )}
              <section className="place-visitors">
                <h3>
                  <Users size={17} />
                  Ils connaissent ce lieu
                </h3>
                {visitors.length ? (
                  visitors.map((v) => (
                    <div key={v.id}>
                      <Avatar name={v.name} src={v.avatar} />
                      <span>{v.name}</span>
                    </div>
                  ))
                ) : (
                  <p>Aucune visite partagée pour le moment.</p>
                )}
                <small>
                  Seules les visites visibles pour vous apparaissent.
                </small>
              </section>
              {selected.state && (
                <button
                  className="text-action danger"
                  disabled={saving}
                  onClick={() => {
                    if (
                      confirm(
                        "Retirer ce lieu de votre collection et effacer vos notes ?",
                      )
                    )
                      void api(`/api/v1/places/${selected.id}/entry`, "DELETE")
                        .then(() => {
                          setSaved("");
                          void load();
                        })
                        .catch((e) => setError(e.message));
                  }}
                >
                  Retirer de ma collection
                </button>
              )}
            </>
          ) : (
            <>
              <h2>
                {filter === "search"
                  ? "Résultats de recherche"
                  : filter === "nearby"
                    ? "Lieux sur la carte"
                    : filter === "wishlist"
                      ? "À essayer"
                      : filter === "visited"
                        ? "Mes visites"
                        : "Ma collection"}
                <small>{list.length}</small>
              </h2>
              {filter !== "search" && (
                <label className="place-collection-filter">
                  <span className="visually-hidden">
                    Filtrer ma liste de lieux
                  </span>
                  <input
                    placeholder="Filtrer ma liste…"
                    value={collectionQuery}
                    onChange={(e) => setCollectionQuery(e.target.value)}
                  />
                </label>
              )}
              {filter === "search" ? (
                searching ? (
                  <p role="status">Recherche des lieux…</p>
                ) : searchError ? (
                  <div className="place-search-error" role="alert">
                    <p>{searchError}</p>
                    <button
                      onClick={() =>
                        void search(
                          lastSearch.current.q,
                          lastSearch.current.center,
                          lastSearch.current.nearby,
                        )
                      }
                    >
                      Réessayer
                    </button>
                    <button className="text-action" onClick={manual}>
                      Placer le lieu sur la carte
                    </button>
                  </div>
                ) : (
                  results?.area && (
                    <p className="place-result-area">
                      {lastSearch.current.nearby
                        ? "Autour de "
                        : "Première correspondance : "}
                      <strong>{results.area.label}</strong>
                      <small>
                        {lastSearch.current.nearby
                          ? "Dans un rayon de 15 km · "
                          : ""}
                        {list.length} résultat
                        {list.length > 1 ? "s" : ""}
                      </small>
                    </p>
                  )
                )
              ) : (
                loading && <p role="status">Actualisation de la carte…</p>
              )}
              {!searching &&
                !searchError &&
                (!loading || filter === "search") &&
                !list.length && (
                  <Empty
                    title={
                      filter === "search"
                        ? results?.area
                          ? "Aucun lieu trouvé dans cette zone"
                          : "Aucun lieu trouvé"
                        : collectionQuery
                          ? "Aucun lieu dans cette liste"
                          : "Votre prochaine adresse commence ici"
                    }
                  >
                    {filter === "search"
                      ? "Précisez la ville ou essayez une autre zone. Un lieu manquant peut aussi être ajouté sur la carte."
                      : collectionQuery
                        ? "Essayez un autre filtre."
                        : "Recherchez un lieu ou une adresse ci-dessus, puis choisissez À essayer ou Visité."}
                    {filter === "search" ? (
                      <button
                        onClick={() => {
                          searchInput.current?.focus();
                          searchInput.current?.scrollIntoView({
                            block: "center",
                          });
                        }}
                      >
                        Modifier la recherche
                      </button>
                    ) : (
                      <button onClick={() => searchInput.current?.focus()}>
                        Trouver un restaurant
                      </button>
                    )}
                  </Empty>
                )}
              {list.map((p) => (
                <button
                  className="place-list-row"
                  key={p.id}
                  onClick={() => {
                    open(p);
                    map.current?.setView([p.latitude, p.longitude], 16);
                  }}
                >
                  <span className={`place-list-icon ${p.state || "unmarked"}`}>
                    {p.state === "visited" ? (
                      <Check size={17} />
                    ) : p.state === "wishlist" ? (
                      <Bookmark size={17} />
                    ) : (
                      <MapPin size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.address || "Adresse non renseignée"}</small>
                    {p.distance_m !== undefined && filter === "search" && lastSearch.current.nearby && (
                      <small>
                        {new Intl.NumberFormat("fr-FR", {
                          maximumFractionDigits: 1,
                        }).format(p.distance_m / 1000)}{" "}
                        {lastSearch.current.nearby
                          ? "km du centre recherché"
                          : "km de la première correspondance"}
                      </small>
                    )}
                  </span>
                  <small>
                    {p.state === "visited"
                      ? "Visité"
                      : p.state === "wishlist"
                        ? "À essayer"
                        : ""}
                  </small>
                </button>
              ))}
              {filter === "nearby" && more && (
                <p className="muted">
                  Les 200 premiers lieux sont affichés. Zoomez pour affiner.
                </p>
              )}
              {filter === "search" && (
                <small className="place-attribution">
                  Résultats ©{" "}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenStreetMap
                  </a>{" "}
                  · Photon
                </small>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
