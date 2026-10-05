// src/client/Calendar.tsx
import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Star,
} from "lucide-react";
import { CalendarSync } from "./CalendarSync";
import { api } from "./api";
import { Empty, FormDialog, Modal, type Field } from "./ui";
import type { Row, Result } from "./types";
import {
  dateKey,
  localDateTime,
  instantFromLocal,
  recurrenceLabels,
} from "../shared/schedule";
const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const recurrenceOptions = Object.entries(recurrenceLabels).map(
  ([value, label]) => ({ value, label }),
);
export function Calendar({
  base,
  can,
  userId,
  revision,
  refresh,
  fail,
  initialEvent = "",
}: {
  base: string;
  can: (p: string) => boolean;
  userId: string;
  revision: number;
  refresh: () => void;
  fail: (e: unknown) => void;
  initialEvent?: string;
}) {
  const [events, setEvents] = useState<Row[]>([]),
    [month, setMonth] = useState(() => new Date()),
    [selected, setSelected] = useState<Row | null>(null),
    [search, setSearch] = useState(""),
    [day, setDay] = useState(""),
    [mode, setMode] = useState(() =>
      matchMedia("(max-width:760px)").matches ? "agenda" : "month",
    );
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [form, setForm] = useState<{
    title: string;
    fields: Field[];
    save: (d: Record<string, string>) => Promise<void>;
  } | null>(null);
  const start = localKey(new Date(month.getFullYear(), month.getMonth(), 1)),
    end = localKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  useEffect(() => {
    setLoading(true);
  }, [base, start, end]);
  useEffect(() => {
    let gone = false;
    setError("");
    void api<Result>(
      `${base}/calendar?start=${start}&end=${end}&timezone=${encodeURIComponent(zone())}`,
    )
      .then((r) => {
        if (!gone) {
          setEvents(r.data);
        }
      })
      .catch((e) => {
        if (!gone) {
          setEvents([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [base, start, end, revision, initialEvent]);
  useEffect(() => {
    if (!initialEvent) return;
    let gone = false;
    void api<{ data: Row }>(`${base}/calendar/${initialEvent}`)
      .then((r) => {
        if (!gone) {
          setSelected(r.data);
          setMonth(new Date(r.data.start_at));
        }
      })
      .catch(fail);
    return () => {
      gone = true;
    };
  }, [base, initialEvent]);
  const edit = (event?: Row) => {
    const timezone = event?.timezone || zone();
    setForm({
      title: event ? "Modifier l’événement et sa série" : "Nouvel événement",
      fields: [
        { key: "title", label: "Titre", value: event?.title },
        {
          key: "description",
          label: "Description",
          type: "textarea",
          required: false,
          value: event?.description,
        },
        {
          key: "start_at",
          label: "Début",
          type: "datetime-local",
          value: event
            ? localDateTime(event.series_start_at || event.start_at, timezone)
            : `${day || localKey(new Date())}T09:00`,
        },
        {
          key: "end_at",
          label: "Fin (facultative)",
          type: "datetime-local",
          required: false,
          value:
            event && (event.series_end_at || event.end_at)
              ? localDateTime(event.series_end_at || event.end_at!, timezone)
              : "",
        },
        { key: "timezone", label: "Fuseau horaire", value: timezone },
        {
          key: "all_day",
          label: "Toute la journée (les dates sont ramenées à minuit)",
          value: String(event?.all_day || false),
          options: [
            { value: "false", label: "Non" },
            { value: "true", label: "Oui" },
          ],
        },
        {
          key: "recurrence",
          label: "Répétition",
          value: event?.recurrence || "none",
          options: recurrenceOptions,
        },
        {
          key: "reminder_minutes",
          label: "Me rappeler avant l’événement (auteur uniquement)",
          value:
            event?.reminder_minutes == null
              ? ""
              : String(event.reminder_minutes),
          required: false,
          options: [
            { value: "", label: "Aucun rappel" },
            { value: "0", label: "À l’heure de début" },
            { value: "15", label: "15 minutes avant" },
            { value: "60", label: "Une heure avant" },
            { value: "1440", label: "La veille" },
          ],
        },
      ],
      save: async (d) => {
        const allDay = d.all_day === "true";
        const from = allDay ? `${d.start_at.slice(0, 10)}T00:00` : d.start_at;
        let to = d.end_at
          ? allDay
            ? `${d.end_at.slice(0, 10)}T00:00`
            : d.end_at
          : "";
        if (allDay && !to) {
          const next = new Date(`${d.start_at.slice(0, 10)}T12:00`);
          next.setDate(next.getDate() + 1);
          to = `${localKey(next)}T00:00`;
        }
        await api(
          `${base}/calendar${event ? `/${event.id}` : ""}`,
          event ? "PATCH" : "POST",
          {
            title: d.title,
            description: d.description,
            start_at: instantFromLocal(from, d.timezone),
            end_at: to ? instantFromLocal(to, d.timezone) : null,
            timezone: d.timezone,
            all_day: allDay,
            recurrence: d.recurrence,
            reminder_minutes:
              d.reminder_minutes === "" ? null : Number(d.reminder_minutes),
          },
        );
        setSelected(null);
        refresh();
      },
    });
  };
  const filtered = events.filter((e) =>
    e.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const keyFor = (e: Row) =>
    dateKey(e.start_at, e.all_day ? e.timezone : zone());
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const first =
    (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const label = (e: Row) =>
    new Date(e.start_at).toLocaleString("fr-FR", {
      timeZone: e.timezone,
      dateStyle: "medium",
      ...(e.all_day ? {} : { timeStyle: "short" }),
    });
  const canEdit = (e: Row) => e.user_id === userId || can("MANAGE_CALENDAR");
  const fallsOn = (e: Row, k: string) =>
    keyFor(e) <= k &&
    dateKey(
      e.end_at ? new Date(Date.parse(e.end_at) - 1) : e.start_at,
      e.all_day ? e.timezone : zone(),
    ) >= k;
  const agenda = filtered.filter((e) => !day || fallsOn(e, day));
  return (
    <div className="page calendar-page">
      <header className="page-heading">
        <div>
          <h1>Calendrier</h1>
          <p>
            Les rendez-vous de l’équipe. Horaires affichés dans votre fuseau :{" "}
            {zone()}.
          </p>
        </div>
        {can("CREATE_CALENDAR_EVENT") && (
          <button className="primary" onClick={() => edit()}>
            <Plus size={16} />
            Nouvel événement
          </button>
        )}
      </header>
      <details className="calendar-sync-disclosure"><summary>Synchroniser mes agendas</summary><CalendarSync workspace={base.split("/").at(-1)}/></details>
      <div className="calendar-summary">
        <strong>{filtered.length} rendez-vous ce mois-ci</strong>
        <span>
          {day
            ? new Date(`${day}T12:00`).toLocaleDateString("fr-FR", {
                dateStyle: "full",
              })
            : "Choisissez un jour ou parcourez l’agenda."}
        </span>
        <div className="segmented">
          <button
            aria-pressed={mode === "month"}
            onClick={() => setMode("month")}
          >
            Mois
          </button>
          <button
            aria-pressed={mode === "agenda"}
            onClick={() => setMode("agenda")}
          >
            Agenda
          </button>
        </div>
      </div>
      <div className="calendar-toolbar">
        <button
          aria-label="Mois précédent"
          onClick={() => {
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
            setDay("");
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <h2>
          {month.toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <button
          aria-label="Mois suivant"
          onClick={() => {
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
            setDay("");
          }}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => {
            setMonth(new Date());
            setDay("");
          }}
        >
          Aujourd’hui
        </button>
      </div>
      <label className="calendar-search">
        Rechercher un événement
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Titre de l’événement"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Chargement du calendrier…</p>
      ) : (
        <>
          {mode === "month" && (
            <div className="calendar-grid">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div className="calendar-day-header" key={d}>
                  {d}
                </div>
              ))}
              {Array.from({ length: first }, (_, i) => (
                <div className="calendar-cell is-outside" key={`empty${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const k = localKey(
                    new Date(month.getFullYear(), month.getMonth(), i + 1),
                  ),
                  items = filtered.filter((e) => fallsOn(e, k));
                return (
                  <div
                    key={k}
                    className={`calendar-cell${k === localKey(new Date()) ? " today" : ""}`}
                  >
                    <button
                      className="calendar-date"
                      aria-label={`${i + 1} ${month.toLocaleDateString("fr-FR", { month: "long" })}, ${items.length} événement(s)`}
                      onClick={() => setDay(day === k ? "" : k)}
                      aria-pressed={day === k}
                    >
                      {i + 1}
                      {items.length > 0 && (
                        <span className="calendar-count">
                          {" "}
                          · {items.length}
                        </span>
                      )}
                    </button>
                    {items.slice(0, 3).map((e) => (
                      <button
                        key={e.occurrence_id}
                        className="calendar-event"
                        onClick={() => setSelected(e)}
                      >
                        {e.title}
                      </button>
                    ))}
                    {items.length > 3 && (
                      <button
                        className="calendar-more"
                        onClick={() => setDay(k)}
                      >
                        Voir les {items.length} événements
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <section
            className="calendar-agenda"
            aria-label="Liste des événements"
          >
            <h2>
              {day
                ? new Date(`${day}T12:00`).toLocaleDateString("fr-FR", {
                    dateStyle: "full",
                  })
                : "Votre agenda du mois"}
            </h2>
            {day && (
              <button onClick={() => setDay("")}>Afficher tout le mois</button>
            )}
            {!agenda.length ? (
              <Empty title="Aucun événement">
                {search
                  ? "Aucun titre ne correspond à cette recherche."
                  : "Les événements de cette période apparaîtront ici."}
              </Empty>
            ) : (
              agenda.map((e) => (
                <button
                  className="calendar-agenda-row"
                  key={e.occurrence_id}
                  onClick={() => setSelected(e)}
                >
                  <time>
                    {label(e)}
                    {e.all_day ? " · Toute la journée" : ""}
                  </time>
                  <strong>{e.title}</strong>
                  <span>
                    {e.recurrence !== "none"
                      ? recurrenceLabels[
                          e.recurrence as keyof typeof recurrenceLabels
                        ]
                      : ""}
                  </span>
                </button>
              ))
            )}
          </section>
        </>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="integration-dialog-body">
            <p>{selected.description}</p>
            <p>
              {label(selected)}
              {selected.end_at
                ? ` → ${new Date(selected.end_at).toLocaleString("fr-FR", { timeZone: selected.timezone })}`
                : ""}{" "}
              · {selected.timezone}
            </p>
            <p>
              {
                recurrenceLabels[
                  selected.recurrence as keyof typeof recurrenceLabels
                ]
              }{" "}
              · Créé par {selected.author_name}
            </p>
            {selected.recurrence !== "none" && (
              <p>La modification ou la suppression concerne toute la série.</p>
            )}
            <div className="row-actions">
              <button
                onClick={() =>
                  void api(`${base}/favorites`, "POST", {
                    target_type: "event",
                    target_id: selected.id,
                  })
                    .then(() => {
                      setSelected(null);
                      refresh();
                    })
                    .catch(fail)
                }
              >
                <Star size={16} />
                Ajouter aux favoris
              </button>
              {canEdit(selected) && (
                <>
                  <button onClick={() => edit(selected)}>
                    <Pencil size={16} />
                    Modifier
                  </button>
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
                    <Trash2 size={16} />
                    Supprimer{selected.recurrence !== "none" ? " la série" : ""}
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
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
