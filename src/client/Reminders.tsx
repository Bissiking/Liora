// src/client/Reminders.tsx
import { useEffect, useState, useCallback } from "react";
import { Bell, Plus, Clock, Check, Trash2, RotateCcw } from "lucide-react";
import { api } from "./api";
import type { Row, Result } from "./types";
import { Empty, FormDialog, type Field } from "./ui";

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
  const [reminders, setReminders] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "done">("all");
  const [form, setForm] = useState<{
    title: string;
    fields: Field[];
    save: (d: Record<string, string>) => Promise<void>;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<Result>(`${base}/reminders?state=${filter}`);
      setReminders(r.data);
    } catch (e) {
      fail(e);
    }
  }, [base, filter, fail]);

  useEffect(() => {
    void load();
  }, [load, revision]);

  const createReminder = () =>
    setForm({
      title: "Nouveau rappel",
      fields: [
        { key: "title", label: "Titre" },
        { key: "body", label: "Note", required: false },
        { key: "remind_at", label: "Rappeler le (AAAA-MM-JJ HH:MM)" },
        {
          key: "recurring",
          label: "Récurrent",
          options: [
            { value: "false", label: "Non" },
            { value: "true", label: "Oui" },
          ],
        },
        {
          key: "recurring_interval",
          label: "Intervalle",
          required: false,
          options: [
            { value: "", label: "—" },
            { value: "daily", label: "Quotidien" },
            { value: "weekly", label: "Hebdomadaire" },
            { value: "monthly", label: "Mensuel" },
          ],
        },
      ],
      save: async (d) => {
        await api(`${base}/reminders`, "POST", {
          ...d,
          body: d.body || "",
          recurring: d.recurring === "true",
          recurring_interval: d.recurring_interval || null,
        });
        setForm(null);
        refresh();
      },
    });

  const pending = reminders.filter((r) => r.state === "pending");
  const done = reminders.filter((r) => r.state === "done" || r.state === "dismissed");

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <h1>Rappels</h1>
          <p>Vos rappels personnels et récurrents.</p>
        </div>
        <button className="primary" onClick={createReminder}>
          <Plus size={16} />
          Nouveau rappel
        </button>
      </header>
      <div className="section-toolbar">
        {(["all", "pending", "done"] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? "active" : ""}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Tous" : f === "pending" ? "En cours" : "Terminés"}
          </button>
        ))}
      </div>
      {!reminders.length ? (
        <Empty title="Aucun rappel">
          Créez un rappel pour ne rien oublier.
        </Empty>
      ) : (
        reminders.map((r) => (
          <article className="reminder-row" key={r.id}>
            <Bell size={18} className={r.state === "done" ? "muted" : ""} />
            <div className="reminder-main">
              <strong className={r.state === "done" ? "muted" : ""}>
                {r.title}
              </strong>
              {r.body && <p>{r.body}</p>}
              <small>
                <Clock size={11} />{" "}
                {new Date(r.remind_at).toLocaleString("fr-FR")}
                {r.recurring && ` · ${r.recurring_interval}`}
              </small>
            </div>
            <div className="row-actions">
              {r.state === "pending" && (
                <button
                  onClick={() =>
                    void api(`${base}/reminders/${r.id}`, "PATCH", {
                      state: "done",
                    })
                      .then(refresh)
                      .catch(fail)
                  }
                >
                  <Check size={13} />
                  Terminer
                </button>
              )}
              {r.state === "pending" && (
                <button
                  onClick={() => {
                    const next = new Date(r.remind_at);
                    next.setHours(next.getHours() + 1);
                    void api(`${base}/reminders/${r.id}`, "PATCH", {
                      state: "snoozed",
                      remind_at: next.toISOString(),
                    })
                      .then(refresh)
                      .catch(fail);
                  }}
                >
                  <RotateCcw size={13} />
                  Reporter 1h
                </button>
              )}
              <button
                onClick={() =>
                  void api(`${base}/reminders/${r.id}`, "DELETE")
                    .then(refresh)
                    .catch(fail)
                }
              >
                <Trash2 size={13} />
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
