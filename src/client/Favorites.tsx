// src/client/Favorites.tsx
import { useEffect, useState } from "react";
import { Star, Plus, Trash2 } from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
import { Empty, Modal } from "./ui";
const labels: Record<string, string> = {
  channel: "Salon",
  page: "Page",
  project: "Projet",
  task: "Tâche",
  event: "Événement",
  message: "Message",
};
export function Favorites({
  base,
  revision,
  onNavigate,
  fail,
}: {
  base: string;
  revision: number;
  onNavigate: (row: Row) => void;
  fail: (e: unknown) => void;
}) {
  const [favorites, setFavorites] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [adding, setAdding] = useState(false),
    [type, setType] = useState("channel"),
    [targets, setTargets] = useState<Row[]>([]),
    [target, setTarget] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [localRevision, setLocalRevision] = useState(0);
  useEffect(() => {
    setLoading(true);
  }, [base]);
  useEffect(() => {
    let gone = false;
    void api<Result>(`${base}/favorites`)
      .then((r) => {
        if (!gone) setFavorites(r.data);
      })
      .catch((e) => {
        if (!gone) {
          setFavorites([]);
          fail(e);
        }
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [base, revision, localRevision]);
  useEffect(() => {
    if (!adding) return;
    let gone = false;
    setError("");
    setTargets([]);
    setTarget("");
    const resource = {
      channel: "channels",
      page: "pages",
      project: "projects",
      task: "tasks",
      event: "calendar",
    }[type];
    void collection(
      `${base}/${resource}${type === "event" ? `?start=${new Date().toISOString().slice(0, 10)}&end=${new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)}` : ""}`,
    )
      .then((r) => {
        if (!gone) {
          const rows = [
            ...new Map(
              r.data.filter((x) => !x.archived).map((x) => [x.id, x]),
            ).values(),
          ];
          setTargets(rows);
          setTarget(rows[0]?.id || "");
        }
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [base, adding, type]);
  return (
    <div className="page favorites-page">
      <header className="page-heading">
        <div>
          <h1>Favoris</h1>
          <p>
            Vos raccourcis privés. Seules les ressources auxquelles vous avez
            encore accès apparaissent ici.
          </p>
        </div>
        <button className="primary" onClick={() => setAdding(true)}>
          <Plus size={16} />
          Ajouter un favori
        </button>
      </header>
      {loading ? (
        <p role="status">Chargement des favoris…</p>
      ) : !favorites.length ? (
        <Empty title="Aucun favori">
          Ajoutez un salon, une page, un projet, une tâche ou un événement.
        </Empty>
      ) : (
        favorites.map((f) => (
          <article className="favorite-row" key={f.id}>
            <Star size={18} />
            <div>
              <strong>{f.label || f.target_name}</strong>
              <small>{labels[f.target_type]}</small>
            </div>
            <button onClick={() => onNavigate(f)}>Ouvrir</button>
            <button
              className="icon-button"
              aria-label={`Retirer ${f.label || f.target_name} des favoris`}
              onClick={() =>
                void api(`${base}/favorites/${f.id}`, "DELETE")
                  .then(() => setLocalRevision((n) => n + 1))
                  .catch(fail)
              }
            >
              <Trash2 size={16} />
            </button>
          </article>
        ))
      )}
      {adding && (
        <Modal title="Ajouter un favori" onClose={() => setAdding(false)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              void api(`${base}/favorites`, "POST", {
                target_type: type,
                target_id: target,
              })
                .then(() => {
                  setAdding(false);
                  setLocalRevision((n) => n + 1);
                })
                .catch((e) => setError(e.message))
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Type
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(labels)
                  .filter(([k]) => k !== "message")
                  .map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Élément
              <select
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choisir un élément</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title || t.name}
                  </option>
                ))}
              </select>
            </label>
            {type === "event" && <p>Événements des 90 prochains jours.</p>}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || !target}>
              Ajouter
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
