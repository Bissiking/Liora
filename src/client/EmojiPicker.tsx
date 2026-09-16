// src/client/EmojiPicker.tsx
import { useEffect, useState } from "react";
import { Modal } from "./ui";
type Emoji = {
  emoji: string;
  label: string;
  tags?: string[];
  group?: number;
  order?: number;
  skins?: Emoji[];
};
const groups = [
  "Visages et émotions",
  "Personnes et gestes",
  "Composants",
  "Animaux et nature",
  "Alimentation",
  "Voyages et lieux",
  "Activités",
  "Objets",
  "Symboles",
  "Drapeaux",
];
export function EmojiPicker({
  select,
  close,
  custom = [],
}: {
  select: (emoji: string) => void;
  close: () => void;
  custom?: string[];
}) {
  const [data, setData] = useState<Emoji[]>([]),
    [q, setQ] = useState(""),
    [group, setGroup] = useState(""),
    [tone, setTone] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    void import("emojibase-data/fr/data.json")
      .then((m) =>
        setData(
          (m.default as Emoji[])
            .filter((e) => e.group !== undefined)
            .sort((a, b) => (a.order || 0) - (b.order || 0)),
        ),
      )
      .catch(() =>
        setError("Le catalogue n’a pas pu être chargé. Réouvrez le sélecteur."),
      );
  }, []);
  const normalized = q.toLocaleLowerCase("fr");
  const rows = data.filter(
    (e) =>
      (!group || String(e.group) === group) &&
      (!q ||
        `${e.label} ${e.tags?.join(" ")}`
          .toLocaleLowerCase("fr")
          .includes(normalized)),
  );
  return (
    <Modal title="Choisir un emoji" onClose={close}>
      <div className="emoji-catalog">
        <input
          aria-label="Rechercher un emoji"
          placeholder="Sourire, cœur, chat…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="emoji-controls">
          <select
            aria-label="Catégorie d’emojis"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {groups.map((g, i) => (
              <option key={g} value={i}>
                {g}
              </option>
            ))}
          </select>
          <select
            aria-label="Teinte de peau"
            value={tone}
            onChange={(e) => setTone(Number(e.target.value))}
          >
            <option value={0}>Teinte par défaut</option>
            {[
              "Claire",
              "Moyennement claire",
              "Mate claire",
              "Mate",
              "Foncée",
            ].map((t, i) => (
              <option value={i + 1} key={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <small>{rows.length} emojis · noms et recherche en français</small>
        {error && <p role="alert">{error}</p>}
        <div className="emoji-grid">
          {custom
            .filter((e) => !q || e.includes(q))
            .map((e) => (
              <button
                key={e}
                title={e}
                onClick={() => {
                  select(e);
                  close();
                }}
              >
                {e}
              </button>
            ))}
          {rows.map((e) => {
            const variant = tone ? e.skins?.[tone - 1] || e : e;
            return (
              <button
                key={e.emoji}
                title={variant.label}
                aria-label={`Insérer ${variant.label}`}
                onClick={() => {
                  select(variant.emoji);
                  close();
                }}
              >
                {variant.emoji}
              </button>
            );
          })}
        </div>
        {!data.length && !error && <p>Chargement du catalogue…</p>}
      </div>
    </Modal>
  );
}
