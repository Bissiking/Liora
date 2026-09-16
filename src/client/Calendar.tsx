// src/client/Calendar.tsx
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Clock, Trash2 } from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
import { Empty, FormDialog, type Field } from "./ui";

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function Calendar({
  base,
  can,
  revision,
  refresh,
  fail,
}: {
  base: string;
  can: (p: string) => boolean;
  revision: number;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const [events, setEvents] = useState<Row[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Row | null>(null);
  const [form, setForm] = useState<{
    title: string;
    fields: Field[];
    save: (d: Record<string, string>) => Promise<void>;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const start = fmtDate(startOfMonth(addDays(month, -7)));
      const end = fmtDate(endOfMonth(addDays(month, 7)));
      const r = await api<Result>(`${base}/calendar?start=${start}&end=${end}`);
      setEvents(r.data);
    } catch (e) {
      fail(e);
    }
  }, [base, month, fail]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  const daysInMonth = endOfMonth(month).getDate();
  const firstDay = (startOfMonth(month).getDay() + 6) % 7;
  const today = new Date();
  const todayStr = fmtDate(today);

  const grid: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    grid.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (grid.length % 7 !== 0) grid.push(null);

  const eventsByDate = new Map<string, Row[]>();
  for (const ev of events) {
    const key = ev.start_at?.slice(0, 10) || "";
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push(ev);
  }

  const createEvent = () =>
    setForm({
      title: "Nouvel événement",
      fields: [
        { key: "title", label: "Titre" },
        { key: "description", label: "Description", required: false },
        { key: "start_at", label: "Début (AAAA-MM-JJ HH:MM)" },
        { key: "end_at", label: "Fin (optionnel)", required: false },
        {
          key: "all_day",
          label: "Toute la journée",
          options: [
            { value: "false", label: "Non" },
            { value: "true", label: "Oui" },
          ],
        },
        {
          key: "recurrence",
          label: "Récurrence",
          options: [
            { value: "none", label: "Aucune" },
            { value: "daily", label: "Quotidienne" },
            { value: "weekly", label: "Hebdomadaire" },
            { value: "monthly", label: "Mensuelle" },
            { value: "yearly", label: "Annuelle" },
          ],
        },
      ],
      save: async (d) => {
        await api(`${base}/calendar`, "POST", {
          ...d,
          all_day: d.all_day === "true",
          description: d.description || "",
          end_at: d.end_at || undefined,
        });
        setForm(null);
        refresh();
      },
    });

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1>Calendrier</h1>
          <p>Événements et échéances de l'équipe.</p>
        </div>
        {can("CREATE_CHANNEL") && (
          <button className="primary" onClick={createEvent}>
            <Plus size={16} />
            Nouvel événement
          </button>
        )}
      </header>
      <div className="calendar-toolbar">
        <button onClick={() => setMonth(addDays(startOfMonth(month), -1))}>
          <ChevronLeft size={16} />
        </button>
        <h2>
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </h2>
        <button onClick={() => setMonth(addDays(endOfMonth(month), 1))}>
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setMonth(new Date())}
          style={{ marginLeft: 12 }}
        >
          Aujourd'hui
        </button>
      </div>
      <div className="calendar-grid">
        {DAYS.map((d) => (
          <div className="calendar-day-header" key={d}>
            {d}
          </div>
        ))}
        {grid.map((d, i) => {
          if (!d) return <div className="calendar-cell empty" key={`e${i}`} />;
          const key = fmtDate(d);
          const dayEvents = eventsByDate.get(key) || [];
          return (
            <div
              className={`calendar-cell${key === todayStr ? " today" : ""}`}
              key={key}
            >
              <span className="calendar-date">{d.getDate()}</span>
              {dayEvents.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  className="calendar-event"
                  style={{ borderLeftColor: ev.color || "var(--accent)" }}
                  onClick={() => setSelected(ev)}
                >
                  {ev.title}
                </button>
              ))}
              {dayEvents.length > 3 && (
                <span className="calendar-more">+{dayEvents.length - 3}</span>
              )}
            </div>
          );
        })}
      </div>
      {selected && (
        <dialog
          open
          onClose={() => setSelected(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <header>
            <h2>{selected.title}</h2>
            <button className="icon-button" onClick={() => setSelected(null)}>
              ✕
            </button>
          </header>
          <div className="integration-dialog-body">
            {selected.description && <p>{selected.description}</p>}
            <p>
              <Clock size={14} />{" "}
              {new Date(selected.start_at).toLocaleString("fr-FR")}
              {selected.end
                ? ` → ${new Date(selected.end).toLocaleString("fr-FR")}`
                : ""}
              {selected.all_day ? " (toute la journée)" : ""}
            </p>
            <p>
              Récurrence :{" "}
              {selected.recurrence === "none" ? "Aucune" : selected.recurrence}
            </p>
            <p>Créé par {selected.author_name}</p>
            {can("CREATE_CHANNEL") && (
              <button
                onClick={() =>
                  void api(`${base}/calendar/${selected.id}`, "DELETE")
                    .then(() => {
                      setSelected(null);
                      refresh();
                    })
                    .catch(fail)
                }
              >
                <Trash2 size={14} />
                Supprimer
              </button>
            )}
          </div>
        </dialog>
      )}
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
