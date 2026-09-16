// src/client/Monitoring.tsx
import { useEffect, useState } from "react";
import {
  Activity,
  Server,
  Radio,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";
import { api } from "./api";
import type { Row, Result } from "./types";
export function Monitoring({
  base,
  revision,
  fail,
}: {
  base: string;
  revision: number;
  fail: (e: unknown) => void;
}) {
  const [targets, setTargets] = useState<Row[]>([]),
    [events, setEvents] = useState<Row[]>([]);
  const load = () =>
    Promise.all([
      api<Result>(`${base}/monitoring`),
      api<Result>(`${base}/events`),
    ])
      .then(([t, e]) => {
        setTargets(t.data);
        setEvents(e.data.filter((x) => x.type.startsWith("argos.")));
      })
      .catch(fail);
  useEffect(() => {
    void load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [base, revision]);
  return (
    <div className="page monitoring-page">
      <header className="page-heading">
        <div>
          <h1>Garder un œil sur le gardien.</h1>
          <p>
            Liora surveille Argus et Argos, indépendamment de leur
            infrastructure.
          </p>
        </div>
        <button onClick={() => void load()}>
          <RefreshCw size={16} />
          Actualiser
        </button>
      </header>
      <div className="monitor-intro">
        <Activity size={23} />
        <p>
          Une veille indépendante
          <span>
            Si le superviseur ne répond plus, l’équipe reste informée ici.
          </span>
        </p>
        <span className="tag">Contrôles périodiques</span>
      </div>
      <div className="monitor-targets">
        {targets.map((t, i) => (
          <section className="monitor-target" key={t.id}>
            <header>
              {t.kind === "heartbeat" ? <Radio /> : <Server />}
              <h2>{t.name}</h2>
              <span className={`status-label ${t.state}`}>
                <i />
                {t.state === "up"
                  ? "Disponible"
                  : t.state === "down"
                    ? "Indisponible"
                    : "Non configuré"}
              </span>
            </header>
            <div className="monitor-reading">
              <strong>{t.latency_ms !== null ? `${t.latency_ms}` : "—"}</strong>
              <span>
                {t.kind === "heartbeat"
                  ? "heartbeat authentifié"
                  : "ms · dernier contrôle"}
              </span>
            </div>
            <div
              className="uptime"
              aria-label="Historique des 30 derniers contrôles"
            >
              {t.history
                .slice()
                .reverse()
                .map((h, i) => (
                  <span
                    key={i}
                    className={h.state}
                    title={`${new Date(h.created_at).toLocaleString("fr-FR")} · ${h.detail}`}
                  />
                ))}
            </div>
            <details className="monitor-history">
              <summary>Historique des contrôles</summary>
              <ul>
                {t.history.map((h, index) => (
                  <li key={index}>
                    <time>
                      {new Date(h.created_at).toLocaleString("fr-FR")}
                    </time>
                    <span>
                      {h.state === "up"
                        ? "Disponible"
                        : h.state === "down"
                          ? "Indisponible"
                          : "Non configuré"}{" "}
                      — {h.detail}
                      {h.latency_ms !== null ? ` · ${h.latency_ms} ms` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
            <footer>
              <span>Dernier contrôle</span>
              <strong>
                {t.last_checked_at
                  ? new Date(t.last_checked_at).toLocaleTimeString("fr-FR")
                  : "En attente"}
              </strong>
            </footer>
            {t.kind === "heartbeat" && (
              <small>
                Dernier heartbeat :{" "}
                {t.last_heartbeat
                  ? new Date(t.last_heartbeat).toLocaleString("fr-FR")
                  : "aucun reçu"}
              </small>
            )}
          </section>
        ))}
      </div>
      <h2 className="section-heading">Journal des signaux</h2>
      {!events.length ? (
        <p className="muted">Aucun événement Argos reçu pour le moment.</p>
      ) : (
        <div className="event-list">
          {events.slice(0, 30).map((e) => (
            <article key={e.id}>
              <span
                className={`event-dot ${e.type.includes("down") ? "down" : "up"}`}
              />
              <div>
                <strong>{e.type}</strong>
                <p>{String(e.payload.target || e.payload.title || e.source)}</p>
              </div>
              <time>{new Date(e.created_at).toLocaleString("fr-FR")}</time>
            </article>
          ))}
        </div>
      )}
      <p className="operational-note">
        Les états présentés proviennent des contrôles de Liora. Sans URL
        configurée, une cible HTTP reste « Non configuré ». Un heartbeat absent
        est signalé comme indisponible.
      </p>
    </div>
  );
}
