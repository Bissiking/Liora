// src/client/Home.tsx
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Hash,
  AlarmClock,
  Star,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import { api } from "./api";
import type { Row, Result, User, Workspace } from "./types";
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function Home({
  base,
  user,
  workspace,
  channels,
  notifications,
  revision,
  navigate,
  openChannel,
  openResource,
}: {
  base: string;
  user: User;
  workspace: Workspace;
  channels: Row[];
  notifications: Row[];
  revision: number;
  navigate: (view: string) => void;
  openChannel: (id: string) => void;
  openResource: (row: Row) => void;
}) {
  const [data, setData] = useState<Record<string, Row[]>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let gone = false;
    setLoading(true);
    setErrors([]);
    setData({});
    const today = new Date(),
      week = new Date(today);
    week.setDate(today.getDate() + 7);
    const resources = [
      [
        "calendar",
        `calendar?start=${localDate(today)}&end=${localDate(week)}&timezone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`,
      ],
      ["reminders", "reminders?state=pending"],
      ["favorites", "favorites"],
    ];
    void Promise.allSettled(
      resources.map(async ([key, path]) => {
        const result = await api<Result>(`${base}/${path}`);
        return [key, result.data] as const;
      }),
    ).then((results) => {
      if (gone) return;
      const next: Record<string, Row[]> = {},
        unavailable: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
        else unavailable.push(resources[i][0]);
      });
      setData(next);
      setErrors(unavailable);
      setLoading(false);
    });
    return () => {
      gone = true;
    };
  }, [base, revision, retry]);
  const unread = notifications.filter((n) => n.state === "unread");
  const events = (data.calendar || [])
    .filter((e) => Date.parse(e.end_at || e.start_at) >= Date.now())
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const allowedChannels = channels.filter(
    (c) =>
      !c.archived &&
      (c.type !== "monitoring" ||
        workspace.permissions.includes("VIEW_MONITORING")),
  );
  const sectionState = (key: string, empty: string) =>
    loading ? (
      <div className="home-skeleton" role="status" aria-label="Chargement">
        <span />
        <span />
        <span />
      </div>
    ) : errors.includes(key) ? (
      <div className="home-unavailable" role="status">
        <p>Cette rubrique est momentanément indisponible.</p>
        <button onClick={() => setRetry((n) => n + 1)}>Réessayer</button>
      </div>
    ) : !data[key]?.length ? (
      <p className="home-empty">{empty}</p>
    ) : null;
  return (
    <div className="page home-page">
      <header className="home-heading">
        <div>
          <h1>Bonjour, {user.name.split(" ")[0]}.</h1>
          <p>
            Votre équipe, vos priorités. Reprenez le fil dans {workspace.name}.
          </p>
        </div>
        <time dateTime={localDate(new Date())}>
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </time>
      </header>
      <div className="home-layout">
        <div className="home-primary">
          <section className="home-section attention-section">
            <header>
              <h2>
                <Bell size={19} /> À votre attention
              </h2>
              <button
                className="text-button"
                onClick={() => navigate("notifications")}
              >
                Tout voir <ArrowRight size={16} />
              </button>
            </header>
            {unread.length ? (
              <>
                <p className="attention-summary">
                  {unread.length} notification{unread.length > 1 ? "s" : ""} non
                  lue{unread.length > 1 ? "s" : ""}
                </p>
                {unread.slice(0, 3).map((n) => (
                  <button
                    key={n.id}
                    className="home-row"
                    onClick={() => navigate("notifications")}
                  >
                    <Bell size={17} />
                    <span>
                      <strong>{n.title}</strong>
                      <small>{n.body}</small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </>
            ) : (
              <div className="attention-clear">
                <h3>Vous êtes à jour.</h3>
                <p>
                  Les mentions, tâches attribuées et alertes vous attendront
                  ici.
                </p>
              </div>
            )}
          </section>
          <section className="home-section">
            <header>
              <h2>
                <CalendarDays size={19} /> Les prochains rendez-vous
              </h2>
              <button
                className="text-button"
                onClick={() => navigate("calendar")}
              >
                Calendrier <ArrowRight size={16} />
              </button>
            </header>
            {sectionState(
              "calendar",
              "Aucun rendez-vous prévu pour les sept prochains jours.",
            )}
            {!loading &&
              !errors.includes("calendar") &&
              events.slice(0, 4).map((e) => (
                <button
                  className="home-row event-home-row"
                  key={e.occurrence_id || e.id}
                  onClick={() =>
                    openResource({
                      ...e,
                      target_type: "event",
                      target_id: e.id,
                    })
                  }
                >
                  <time className="date-tile" dateTime={e.start_at}>
                    <strong>{new Date(e.start_at).getDate()}</strong>
                    <small>
                      {new Date(e.start_at).toLocaleDateString("fr-FR", {
                        month: "short",
                      })}
                    </small>
                  </time>
                  <span>
                    <strong>{e.title}</strong>
                    <small>
                      {e.all_day
                        ? "Toute la journée"
                        : new Date(e.start_at).toLocaleString("fr-FR", {
                            weekday: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                    </small>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
            {!loading && data.calendar?.length && !events.length ? (
              <p className="home-empty">
                Aucun autre rendez-vous cette semaine.
              </p>
            ) : null}
          </section>
          <section className="home-section">
            <header>
              <h2>
                <MessageSquare size={19} /> Retrouvez votre équipe
              </h2>
              {workspace.permissions.includes("VIEW_CHANNEL") && (
                <button
                  className="text-button"
                  onClick={() => navigate("chat")}
                >
                  Conversations <ArrowRight size={16} />
                </button>
              )}
            </header>
            {allowedChannels.slice(0, 4).map((c) => (
              <button
                className="home-row"
                key={c.id}
                onClick={() => openChannel(c.id)}
              >
                <Hash size={19} />
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.description ||
                      (c.is_dm ? "Conversation privée" : "Salon de l’équipe")}
                  </small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!allowedChannels.length && (
              <p className="home-empty">
                Les salons accessibles de votre équipe apparaîtront ici.
              </p>
            )}
          </section>
        </div>
        <div className="home-secondary">
          <section className="home-section">
            <header>
              <h2>
                <AlarmClock size={19} /> Mes rappels
              </h2>
              <button
                className="text-button"
                onClick={() => navigate("reminders")}
              >
                Voir <ArrowRight size={16} />
              </button>
            </header>
            {sectionState(
              "reminders",
              "Rien à vous rappeler pour le moment. Créez un rappel pour garder une échéance en tête.",
            )}
            {!loading &&
              !errors.includes("reminders") &&
              data.reminders?.slice(0, 4).map((r) => (
                <button
                  className="home-row"
                  key={r.id}
                  onClick={() => navigate("reminders")}
                >
                  <AlarmClock size={17} />
                  <span>
                    <strong>{r.title}</strong>
                    <small>
                      {new Date(r.remind_at).toLocaleString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </span>
                </button>
              ))}
          </section>
          <section className="home-section">
            <header>
              <h2>
                <Star size={19} /> Mes favoris
              </h2>
              <button
                className="text-button"
                onClick={() => navigate("favorites")}
              >
                Voir <ArrowRight size={16} />
              </button>
            </header>
            {sectionState(
              "favorites",
              "Gardez vos salons, pages et projets à portée de main en les ajoutant aux favoris.",
            )}
            {!loading &&
              !errors.includes("favorites") &&
              data.favorites?.slice(0, 5).map((f) => (
                <button
                  className="home-row"
                  key={f.id}
                  onClick={() => openResource(f)}
                >
                  <Star size={17} />
                  <span>
                    <strong>{f.label || f.target_name}</strong>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
          </section>
          {workspace.permissions.includes("VIEW_PROJECT") && (
            <button
              className="home-project-link"
              onClick={() => navigate("projects")}
            >
              <LayoutGrid size={21} />
              <span>
                <strong>Faites avancer vos projets</strong>
                <small>Retrouvez vos tableaux et vos tâches.</small>
              </span>
              <ArrowRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
