// src/client/QuickSwitch.tsx
import { useRef, useState, useEffect } from "react";
import { Search, Hash, Lock, ArrowRight } from "lucide-react";
import { Modal } from "./ui";
import { navigation, navigationVisible } from "./navigation";
import type { Row } from "./types";
export function QuickSwitch({
  channels,
  can,
  navigate,
  openChannel,
  search,
  close,
}: {
  channels: Row[];
  can: (p: string) => boolean;
  navigate: (view: string) => void;
  openChannel: (id: string) => void;
  search: () => void;
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useRef<HTMLDivElement>(null);
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const matches = (text: string) => normalize(text).includes(normalize(query));
  const items = [
    ...navigation
      .filter((n) => navigationVisible(n, can) && matches(n.label))
      .map((n) => ({
        id: n.id,
        label: n.label,
        detail: n.group,
        icon: n.icon,
        run: () => navigate(n.id),
      })),
    ...channels
      .filter(
        (c) =>
          !c.archived &&
          (c.type !== "monitoring" || can("VIEW_MONITORING")) &&
          matches(c.name),
      )
      .map((c) => ({
        id: c.id,
        label: c.name,
        detail: c.is_dm ? "Conversation privée" : "Salon",
        icon: c.is_private ? Lock : Hash,
        run: () => openChannel(c.id),
      })),
    ...(can("VIEW_CHANNEL")
      ? [
          {
            id: "search",
            label: "Rechercher des messages",
            detail: "Recherche dans les conversations",
            icon: Search,
            run: search,
          },
        ]
      : []),
  ];
  useEffect(() => {
    results.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const run = (index: number) => {
    items[index]?.run();
    close();
  };
  return (
    <Modal title="Aller à…" onClose={close}>
      <div className="quick-switch">
        <label className="quick-search">
          <Search size={20} />
          <span className="visually-hidden">
            Rechercher une rubrique ou un salon
          </span>
          <input
            autoFocus
            value={query}
            placeholder="Une rubrique, un salon…"
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) =>
                  Math.max(
                    0,
                    Math.min(
                      items.length - 1,
                      a + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
              }
              if (e.key === "Enter") {
                e.preventDefault();
                run(active);
              }
            }}
            aria-controls="quick-results"
            aria-activedescendant={
              items[active] ? `quick-${items[active].id}` : undefined
            }
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
          />
        </label>
        <div
          className="quick-results"
          id="quick-results"
          role="listbox"
          aria-label="Rubriques et salons"
          ref={results}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              id={`quick-${item.id}`}
              data-index={index}
              role="option"
              aria-selected={index === active}
              className={index === active ? "active" : ""}
              onClick={() => run(index)}
            >
              <item.icon size={18} />
              <span>
                {item.label}
                <small>{item.detail}</small>
              </span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
        {!items.length && (
          <p role="status">Aucun résultat. Essayez un autre nom.</p>
        )}
        <footer>
          <span>↑ ↓ pour choisir</span>
          <span>Entrée pour ouvrir · Échap pour fermer</span>
        </footer>
      </div>
    </Modal>
  );
}
