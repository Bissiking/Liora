// src/client/Favorites.tsx
import { useEffect, useState, useCallback } from "react";
import { Star, Hash, FileText, LayoutGrid, Calendar, Trash2 } from "lucide-react";
import { api } from "./api";
import type { Row, Result } from "./types";
import { Empty } from "./ui";

const TYPE_ICONS: Record<string, typeof Hash> = {
  channel: Hash,
  page: FileText,
  task: LayoutGrid,
  event: Calendar,
  message: Hash,
};

export function Favorites({
  base,
  onNavigate,
  fail,
}: {
  base: string;
  onNavigate: (type: string, id: string) => void;
  fail: (e: unknown) => void;
}) {
  const [favorites, setFavorites] = useState<Row[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api<Result>(`${base}/favorites`);
      setFavorites(r.data);
    } catch (e) {
      fail(e);
    }
  }, [base, fail]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = (id: string) =>
    void api(`${base}/favorites/${id}`, "DELETE")
      .then(() => setFavorites((old) => old.filter((f) => f.id !== id)))
      .catch(fail);

  return (
    <div className="page favorites-page">
      <header className="page-heading">
        <div>
          <h1>Favoris</h1>
          <p>Vos raccourcis vers les éléments importants.</p>
        </div>
      </header>
      {!favorites.length ? (
        <Empty title="Aucun favori">
          Ajoutez des favoris depuis les channels, pages ou projets.
        </Empty>
      ) : (
        favorites.map((f) => {
          const Icon = TYPE_ICONS[f.target_type] || Hash;
          return (
            <article className="favorite-row" key={f.id}>
              <Icon size={18} />
              <div>
                <strong>{f.label || f.target_name || f.target_type}</strong>
                <small>{f.target_type}</small>
              </div>
              <button
                onClick={() => onNavigate(f.target_type, f.target_id)}
              >
                Ouvrir
              </button>
              <button className="icon-button" onClick={() => remove(f.id)}>
                <Trash2 size={14} />
              </button>
            </article>
          );
        })
      )}
    </div>
  );
}
