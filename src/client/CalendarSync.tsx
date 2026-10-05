// src/client/CalendarSync.tsx
import { useEffect, useState } from "react";
import { RefreshCw, Link, Plus, Trash2, Copy } from "lucide-react";
import { api } from "./api";
import type { Row } from "./types";
type CalendarRow = Row & {
  workspace_id: string;
  calendar_id: string;
  primary?: boolean;
  last_synced_at: string;
  last_used_at: string;
  google_id: string;
  event_id: string | null;
  local_snapshot: Record<string, any>;
  remote_snapshot: Record<string, any>;
  issue: string;
};
type Google = {
  configured: boolean;
  connected: boolean;
  data: CalendarRow | null;
  issues: CalendarRow[];
};
type Dav = { data: CalendarRow[]; server_url: string; username: string };
function EventSnapshot({
  value,
  provider,
  deleted,
  fallbackTimezone = "UTC",
}: {
  value: Record<string, any>;
  provider: "liora" | "google";
  deleted?: boolean;
  fallbackTimezone?: string;
}) {
  if (deleted || value.status === "cancelled") return <p>Supprimé</p>;
  const remote = provider === "google";
  const allDay = remote ? Boolean(value.start?.date) : value.all_day;
  const timezone = remote
    ? value.start?.timeZone || fallbackTimezone
    : value.timezone || "UTC";
  function date(input: string | null) {
    if (!input) return "Sans fin explicite";
    try {
      return new Date(input).toLocaleString("fr-FR", {
        timeZone: timezone,
        ...(allDay
          ? { dateStyle: "medium" }
          : { dateStyle: "medium", timeStyle: "short" }),
      });
    } catch {
      return input;
    }
  }
  function googleDate(part: Record<string, string> | undefined) {
    if (part?.date) return part.date.split("-").reverse().join("/");
    return date(part?.dateTime || null);
  }
  const recurrenceLabels: Record<string, string> = {
    none: "Aucune répétition",
    daily: "Chaque jour",
    weekly: "Chaque semaine",
    monthly: "Chaque mois",
    yearly: "Chaque année",
  };
  const rules: string[] = remote ? value.recurrence || [] : [];
  const recurrence = remote
    ? rules.length
      ? rules
          .map((rule) => {
            const frequency = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(
              rule,
            )?.[1];
            const labels: Record<string, string> = {
              DAILY: "Chaque jour",
              WEEKLY: "Chaque semaine",
              MONTHLY: "Chaque mois",
              YEARLY: "Chaque année",
            };
            return /;(COUNT|UNTIL|INTERVAL)=/.test(rule)
              ? "Répétition personnalisée"
              : labels[frequency || ""] || "Répétition personnalisée";
          })
          .join(" · ")
      : recurrenceLabels.none
    : recurrenceLabels[value.recurrence] || "Répétition personnalisée";
  const reminders = remote ? value.reminders?.overrides || [] : [];
  const reminder = remote
    ? value.reminders?.useDefault
      ? "Rappels de l’agenda Google"
      : reminders.length
        ? reminders
            .map(
              (r: Record<string, any>) =>
                `${r.minutes} min avant (${r.method === "popup" ? "notification" : r.method})`,
            )
            .join(" · ")
        : "Aucun rappel"
    : value.reminder_minutes == null
      ? "Aucun rappel"
      : `${value.reminder_minutes} min avant`;
  return (
    <div className="sync-event-summary">
      <strong>{remote ? value.summary || "Sans titre" : value.title}</strong>
      <p>
        {allDay ? "Journée entière" : "Horaire"} · {timezone}
      </p>
      <p>Début : {remote ? googleDate(value.start) : date(value.start_at)}</p>
      <p>
        Fin{allDay ? " (exclusive)" : ""} :{" "}
        {remote ? googleDate(value.end) : date(value.end_at)}
      </p>
      <p>
        {recurrence} · {reminder}
      </p>
      <p className="sync-event-description">
        {value.description || "Sans description"}
      </p>
      {value.location && <p>Lieu : {value.location}</p>}
    </div>
  );
}
export function CalendarSync({ workspace = "" }: { workspace?: string }) {
  const [google, setGoogle] = useState<Google | null>(null),
    [dav, setDav] = useState<Dav | null>(null),
    [calendars, setCalendars] = useState<CalendarRow[]>([]),
    [workspaces, setWorkspaces] = useState<Row[]>([]),
    [calendar, setCalendar] = useState(""),
    [selectedWorkspace, setWorkspace] = useState(workspace),
    [enabled, setEnabled] = useState(false),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  async function load() {
    const [g, d, m] = await Promise.all([
      api<Google>("/api/v1/google-calendar"),
      api<Dav>("/api/v1/calendar-sync"),
      api<{ workspaces: Row[] }>("/api/v1/me"),
    ]);
    setGoogle(g);
    setDav(d);
    setWorkspaces(
      m.workspaces.filter((w) =>
        w.permissions.includes("CREATE_CALENDAR_EVENT"),
      ),
    );
    setEnabled(g.data?.enabled || false);
    setCalendar(g.data?.calendar_id || "");
    setWorkspace(
      g.data?.workspace_id || workspace || m.workspaces[0]?.id || "",
    );
    if (g.connected) {
      const r = await api<{ data: CalendarRow[] }>(
        "/api/v1/google-calendar/calendars",
      );
      setCalendars(r.data);
      if (!g.data?.calendar_id)
        setCalendar(r.data.find((c) => c.primary)?.id || r.data[0]?.id || "");
    }
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, []);
  async function run(action: () => Promise<unknown>, message = "") {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await load();
      setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="calendar-sync">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section>
        <header>
          <h2>Google Agenda</h2>
          <span className="tag">Dans les deux sens</span>
        </header>
        <p>
          Vos événements Liora apparaissent dans l’agenda Google choisi.
          Modifier ou supprimer ces rendez-vous dans Google actualise Liora.
        </p>
        <p className="muted">
          Seuls les événements dont vous êtes l’auteur, hors salons privés, sont
          liés. Les autres rendez-vous Google restent dans Google. La
          synchronisation automatique passe toutes les cinq minutes.
        </p>
        {!google ? (
          <p role="status">Chargement de la connexion…</p>
        ) : !google.configured ? (
          <p className="empty-hint">
            Le client OAuth Google Agenda doit être configuré par l’opérateur.
          </p>
        ) : !google.connected ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await api<{ url: string }>(
                  "/api/v1/google-calendar/connect",
                  "POST",
                );
                location.assign(r.url);
              })
            }
          >
            <Link size={16} />
            Connecter Google Agenda
          </button>
        ) : (
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    api("/api/v1/google-calendar", "PUT", {
                      workspace_id: selectedWorkspace,
                      calendar_id: calendar,
                      enabled,
                    }),
                  "Réglages Google enregistrés.",
                );
              }}
            >
              <div className="sync-fields">
                <label>
                  Espace Liora
                  <select
                    value={selectedWorkspace}
                    onChange={(e) => setWorkspace(e.target.value)}
                    disabled={Boolean(google.data?.calendar_id)}
                    required
                  >
                    <option value="">Choisir un espace</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Agenda Google
                  <select
                    value={calendar}
                    onChange={(e) => setCalendar(e.target.value)}
                    disabled={Boolean(google.data?.calendar_id)}
                    required
                  >
                    <option value="">Choisir un agenda</option>
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.primary ? " · principal" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                Activer la synchronisation automatique
              </label>
              <button
                className="primary"
                disabled={busy || !calendar || !selectedWorkspace}
              >
                Enregistrer le lien Google
              </button>
            </form>
            <div className="sync-actions">
              <button
                disabled={busy || !google.data?.enabled}
                onClick={() =>
                  void run(async () => {
                    const r = await api<{
                      ok: boolean;
                      error?: string;
                      conflicts?: number;
                    }>("/api/v1/google-calendar/sync", "POST");
                    if (!r.ok) throw Error(r.error);
                    if (r.conflicts)
                      setNotice(
                        `${r.conflicts} conflit(s) à résoudre ci-dessous.`,
                      );
                  }, "Synchronisation terminée. Vérifiez les éventuels conflits ci-dessous.")
                }
              >
                <RefreshCw size={15} />
                {busy ? "Synchronisation…" : "Synchroniser maintenant"}
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Déconnecter Google Agenda ? Les événements existants restent dans les deux agendas.",
                    )
                  )
                    void run(
                      () => api("/api/v1/google-calendar", "DELETE"),
                      "Google Agenda déconnecté.",
                    );
                }}
              >
                Déconnecter Google
              </button>
            </div>
            {google.data?.last_synced_at && (
              <small>
                Dernier passage :{" "}
                {new Date(google.data.last_synced_at).toLocaleString("fr-FR")}
              </small>
            )}
            {google.data?.last_error && (
              <p className="error" role="alert">
                {google.data.last_error}
              </p>
            )}
            {!!google.issues.length && (
              <div className="sync-conflicts">
                <h3>À résoudre</h3>
                {google.issues.map((issue) => (
                  <article key={issue.google_id}>
                    <h4>{issue.local_snapshot.title}</h4>
                    <p>{issue.issue}</p>
                    <dl>
                      <div>
                        <dt>Liora</dt>
                        <dd>
                          <EventSnapshot
                            value={issue.local_snapshot}
                            provider="liora"
                            deleted={issue.event_id === null}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Google</dt>
                        <dd>
                          <EventSnapshot
                            value={issue.remote_snapshot}
                            provider="google"
                            fallbackTimezone={issue.local_snapshot.timezone}
                          />
                        </dd>
                      </div>
                    </dl>
                    <div className="sync-actions">
                      {["liora", "google"].map((version) => (
                        <button
                          key={version}
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const r = await api<{
                                ok: boolean;
                                error?: string;
                              }>("/api/v1/google-calendar/resolve", "POST", {
                                google_id: issue.google_id,
                                version,
                              });
                              if (!r.ok) throw Error(r.error);
                            }, "La synchronisation a été relancée. Les conflits restants figurent ci-dessous.")
                          }
                        >
                          Conserver {version === "liora" ? "Liora" : "Google"}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>
      <details className="caldav-settings">
        <summary>Apple Calendrier et autres applications CalDAV</summary>
        <p>
          Ajoutez un compte CalDAV avec le serveur et votre identifiant
          ci-dessous. Créez un accès distinct par appareil ; son mot de passe
          est affiché une seule fois.
        </p>
        <p className="muted">
          Calendriers d’équipe modifiables selon vos droits. Les notes datées
          personnelles sont disponibles dans un calendrier en lecture seule.
        </p>
        {dav && (
          <>
            <div className="sync-fields">
              <label>
                Serveur
                <input value={dav.server_url} readOnly />
              </label>
              <label>
                Identifiant
                <input value={dav.username} readOnly />
              </label>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api<{ password: string }>(
                    "/api/v1/calendar-sync",
                    "POST",
                    { name },
                  );
                  setPassword(r.password);
                  setName("");
                });
              }}
            >
              <label>
                Nom de l’appareil
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Calendrier sur mon Mac"
                />
              </label>
              <button disabled={busy || !name.trim()}>
                <Plus size={15} />
                Créer un accès CalDAV
              </button>
            </form>
            {password && (
              <div className="one-time-password">
                <label>
                  Mot de passe de cet accès
                  <input readOnly value={password} />
                </label>
                <button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(password)
                      .then(() => setNotice("Mot de passe copié."))
                      .catch((e) => setError(e.message))
                  }
                >
                  <Copy size={15} />
                  Copier
                </button>
                <button onClick={() => setPassword("")}>Masquer</button>
              </div>
            )}
            <div className="caldav-devices">
              {dav.data.map((d) => (
                <article key={d.id}>
                  <div>
                    <strong>{d.name}</strong>
                    <small>
                      {d.last_used_at
                        ? "Dernier accès : " +
                          new Date(d.last_used_at).toLocaleString("fr-FR")
                        : "Pas encore utilisé"}
                    </small>
                  </div>
                  <button
                    className="danger"
                    aria-label={"Révoquer " + d.name}
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Révoquer cet appareil ?"))
                        void run(
                          () => api("/api/v1/calendar-sync/" + d.id, "DELETE"),
                          "Accès révoqué.",
                        );
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </details>
    </div>
  );
}
