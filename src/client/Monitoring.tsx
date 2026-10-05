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
  const [stateFilter, setStateFilter] = useState(""),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [targets, setTargets] = useState<Row[]>([]),
    [events, setEvents] = useState<Row[]>([]);
  const load = () => {
    setError("");
    return Promise.all([
      api<Result>(`${base}/monitoring`),
      api<Result>(`${base}/events`),
    ])
      .then(([t, e]) => {
        setTargets(t.data);
        setEvents(e.data.filter((x) => x.type.startsWith("argos.")));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    void load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [base, revision]);
  return (
    <div className="page monitoring-page">
      <header className="page-heading">
        <div>
          <h1>Supervision</h1>
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
      <div className="monitor-toolbar">
        <input
          type="search"
          aria-label="Rechercher un serveur ou un signal"
          placeholder="Rechercher un serveur ou un signal…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="segmented">
          {[
            ["", "Tous"],
            ["down", "Indisponibles"],
            ["up", "Disponibles"],
            ["unknown", "À configurer"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-pressed={stateFilter === key}
              onClick={() => setStateFilter(key)}
            >
              {label} · {targets.filter((t) => !key || t.state === key).length}
            </button>
          ))}
        </div>
      </div>
      {loading && <p role="status">Chargement des signaux…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
          <button onClick={() => void load()}>Réessayer</button>
        </p>
      )}
      {!loading && !targets.length && (
        <p className="muted">
          Aucun signal configuré. Ajoutez une cible dans les paramètres de
          l’espace.
        </p>
      )}
      {!!targets.length &&
        !targets.some(
          (t) =>
            (!stateFilter || t.state === stateFilter) &&
            t.name
              .toLocaleLowerCase("fr")
              .includes(search.toLocaleLowerCase("fr")),
        ) && <p className="muted">Aucun signal ne correspond à ces filtres.</p>}
      <div className="monitor-targets">
        {targets
          .filter(
            (t) =>
              (!stateFilter || t.state === stateFilter) &&
              t.name
                .toLocaleLowerCase("fr")
                .includes(search.toLocaleLowerCase("fr")),
          )
          .sort(
            (a, b) =>
              ["down", "unknown", "up"].indexOf(a.state) -
              ["down", "unknown", "up"].indexOf(b.state),
          )
          .map((t) => (
            <section
              className={`monitor-target monitor-target-${t.kind}`}
              key={t.id}
            >
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
                <strong>
                  {t.kind === "heartbeat"
                    ? t.last_heartbeat
                      ? t.state === "down"
                        ? "Expiré"
                        : "Reçu"
                      : "Jamais reçu"
                    : t.latency_ms !== null
                      ? `${t.latency_ms}`
                      : "—"}
                </strong>
                <span>
                  {t.kind === "heartbeat"
                    ? "heartbeat authentifié"
                    : "ms · dernier contrôle"}
                </span>
              </div>
              {t.kind !== "heartbeat" && (
                <div className="monitor-stats">
                  {(() => {
                    const samples = t.history
                      .filter((h) => h.latency_ms !== null)
                      .map((h) => h.latency_ms as number);
                    return samples.length ? (
                      <p>
                        Sur les {t.history.length} derniers contrôles ·{" "}
                        {samples.length} mesures
                        <br />
                        Latence min. {Math.min(...samples)} ms · moy.{" "}
                        {Math.round(
                          samples.reduce((a, b) => a + b, 0) / samples.length,
                        )}{" "}
                        ms · max. {Math.max(...samples)} ms
                      </p>
                    ) : (
                      <p>Pas encore de mesure de latence.</p>
                    );
                  })()}
                </div>
              )}
              {t.kind === "heartbeat" && (
                <div className="heartbeat-help">
                  <p>
                    {!t.last_heartbeat
                      ? "Aucun signal envoyé par Argus n’a été enregistré. Les contrôles HTTP réussis ne remplacent pas ce signal."
                      : t.state === "down"
                        ? "Le dernier signal a expiré. Vérifiez le service d’envoi sur Argus, son jeton et sa connexion à Liora."
                        : "Liora reçoit les signaux envoyés par Argus. Leur arrêt déclenchera une alerte après expiration."}
                  </p>
                  <details>
                    <summary>Configurer l’envoi depuis Argus</summary>
                    <ol>
                      <li>
                        Dans le menu de l’espace → Paramètres de l’espace → Bots
                        et services, créez un service avec la permission
                        MANAGE_MONITORING.
                      </li>
                      <li>
                        Sur Argus, configurez l’émetteur décrit dans
                        DOCS/ARGOS.md avec son jeton Liora. Une clé API Argos ne
                        convient pas.
                      </li>
                      <li>
                        Planifiez un envoi toutes les 60 secondes. La carte sera
                        actualisée au prochain contrôle après réception.
                      </li>
                    </ol>
                    <p>Endpoint de cet espace :</p>
                    <code>POST {base}/heartbeat</code>
                  </details>
                </div>
              )}
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
        configurée, une cible HTTP reste « Non configuré ». Le heartbeat exige
        un envoi périodique depuis Argus ; son absence reste une alerte, même
        lorsque les deux contrôles HTTP réussissent.
      </p>
    </div>
  );
}
