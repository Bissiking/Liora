// src/client/Reminders.tsx
import { useEffect, useState } from "react";
import {
  Bell,
  Plus,
  Check,
  Trash2,
  RotateCcw,
  Pencil,
  Archive,
} from "lucide-react";
import { api } from "./api";
import type { Row, Result } from "./types";
import { Empty, FormDialog, type Field } from "./ui";
import {
  localDateTime,
  instantFromLocal,
  recurrenceLabels,
} from "../shared/schedule";
export function Reminders({
  base,
  revision,
  refresh,
  fail,
}: {
  base: string;
  revision: number;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [filter, setFilter] = useState("all"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [form, setForm] = useState<{
    title: string;
    fields: Field[];
    save: (d: Record<string, string>) => Promise<void>;
  } | null>(null);
  useEffect(() => {
    setLoading(true);
  }, [base, filter]);
  useEffect(() => {
    let gone = false;
    setError("");
    void api<Result>(`${base}/reminders?state=${filter}`)
      .then((r) => {
        if (!gone) setRows(r.data);
      })
      .catch((e) => {
        if (!gone) {
          setRows([]);
          setError(e.message);
        }
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [base, revision, filter]);
  const edit = (r?: Row) => {
    const timezone =
      r?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    setForm({
      title: r ? "Modifier le rappel" : "Nouveau rappel",
      fields: [
        { key: "title", label: "Titre", value: r?.title },
        {
          key: "body",
          label: "Note",
          type: "textarea",
          required: false,
          value: r?.body,
        },
        {
          key: "remind_at",
          label: "Rappeler le",
          type: "datetime-local",
          value: localDateTime(
            r?.remind_at || new Date(Date.now() + 3600000),
            timezone,
          ),
        },
        { key: "timezone", label: "Fuseau horaire", value: timezone },
        {
          key: "recurring_interval",
          label: "Répétition",
          value: r?.recurring ? r.recurring_interval || "none" : "none",
          options: Object.entries(recurrenceLabels)
            .filter(([value]) => value !== "yearly")
            .map(([value, label]) => ({ value, label })),
        },
      ],
      save: async (d) => {
        await api(
          `${base}/reminders${r ? `/${r.id}` : ""}`,
          r ? "PATCH" : "POST",
          {
            title: d.title,
            body: d.body,
            timezone: d.timezone,
            remind_at: instantFromLocal(d.remind_at, d.timezone),
            recurring: d.recurring_interval !== "none",
            recurring_interval:
              d.recurring_interval === "none" ? null : d.recurring_interval,
            ...(r ? { state: "pending" } : {}),
          },
        );
        refresh();
      },
    });
  };
  const change = (r: Row, body: unknown) =>
    void api(`${base}/reminders/${r.id}`, "PATCH", body)
      .then(refresh)
      .catch(fail);
  return (
    <div className="page reminders-page">
      <header className="page-heading">
        <div>
          <h1>Rappels</h1>
          <p>
            Une notification dans Liora à l’échéance, et sur vos appareils si
            vous les avez activés.
          </p>
        </div>
        <button className="primary" onClick={() => edit()}>
          <Plus size={16} />
          Nouveau rappel
        </button>
      </header>
      <div className="section-toolbar">
        {[
          ["all", "Tous"],
          ["pending", "En cours"],
          ["done", "Terminés"],
        ].map(([f, label]) => (
          <button
            key={f}
            aria-pressed={filter === f}
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Chargement des rappels…</p>
      ) : !rows.length ? (
        <Empty title="Aucun rappel">
          Créez votre premier rappel ou choisissez un autre filtre.
        </Empty>
      ) : (
        rows.map((r) => (
          <article className="reminder-row" key={r.id}>
            <Bell size={18} />
            <div className="reminder-main">
              <strong>{r.title}</strong>
              {r.body && <p>{r.body}</p>}
              <small>
                {new Date(r.remind_at).toLocaleString("fr-FR", {
                  timeZone: r.timezone,
                })}{" "}
                · {r.timezone}
                {r.recurring
                  ? ` · ${recurrenceLabels[r.recurring_interval as keyof typeof recurrenceLabels]}`
                  : ""}
              </small>
              <small>
                {
                  (
                    {
                      pending: "À venir",
                      snoozed: "Reporté",
                      done: r.last_fired_at ? "Notification créée" : "Terminé",
                      dismissed: "Archivé",
                    } as Record<string, string>
                  )[r.state]
                }
              </small>
            </div>
            <div className="row-actions">
              {["pending", "snoozed"].includes(r.state) && (
                <button onClick={() => change(r, { state: "done" })}>
                  <Check size={14} />
                  Terminer
                </button>
              )}
              {r.state !== "dismissed" && (
                <>
                  <button
                    onClick={() =>
                      change(r, {
                        state: "snoozed",
                        remind_at: new Date(Date.now() + 3600000).toISOString(),
                      })
                    }
                  >
                    <RotateCcw size={14} />
                    Reporter d’une heure
                  </button>
                  <button onClick={() => edit(r)}>
                    <Pencil size={14} />
                    Modifier
                  </button>
                  <button onClick={() => change(r, { state: "dismissed" })}>
                    <Archive size={14} />
                    Archiver
                  </button>
                </>
              )}
              <button
                className="icon-button"
                aria-label={`Supprimer le rappel ${r.title}`}
                onClick={() =>
                  void api(`${base}/reminders/${r.id}`, "DELETE")
                    .then(refresh)
                    .catch(fail)
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))
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
