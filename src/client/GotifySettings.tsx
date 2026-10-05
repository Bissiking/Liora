// src/client/GotifySettings.tsx
import { useEffect, useState } from "react";
import { Bell, RefreshCw, Trash2 } from "lucide-react";
import { api } from "./api";
type Delivery = {
  id: string;
  state: string;
  attempts: number;
  last_error?: string;
  created_at: string;
};
type Configuration = {
  connection: { url: string; enabled: boolean } | null;
  deliveries: Delivery[];
};
export function GotifySettings({ base }: { base: string }) {
  const [url, setUrl] = useState(""),
    [token, setToken] = useState(""),
    [enabled, setEnabled] = useState(true),
    [configured, setConfigured] = useState(false),
    [deliveries, setDeliveries] = useState<Delivery[]>([]),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [status, setStatus] = useState("");
  const load = async (fields = false) => {
    try {
      const r = await api<Configuration>("/api/v1/gotify");
      setConfigured(!!r.connection);
      setDeliveries(r.deliveries);
      if (fields) {
        setUrl(r.connection?.url || "");
        setEnabled(r.connection?.enabled ?? true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(true);
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, []);
  async function run(
    action: () => Promise<unknown>,
    success: string,
    fields = false,
  ) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await action();
      setToken("");
      setStatus(success);
      await load(fields);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="gotify-settings" aria-label="Notifications Gotify">
      <header>
        <Bell size={20} />
        <div>
          <h3>Gotify</h3>
          <p>Recevez vos notifications sur votre serveur Gotify.</p>
        </div>
      </header>
      <p className="muted">
        Un jeton d’application suffit. Le contenu des conversations reste dans
        Liora ; Gotify reçoit une invitation à ouvrir votre réception.
      </p>
      {loading ? (
        <p role="status">Chargement…</p>
      ) : (
        <>
          <div className="gotify-fields">
            <label>
              Adresse du serveur
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://gotify.exemple.fr"
              />
            </label>
            <label>
              Jeton d’application
              <input
                type="password"
                autoComplete="new-password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={
                  configured
                    ? "Enregistré · laisser vide pour le conserver"
                    : "Jeton créé dans Gotify → Applications"
                }
              />
            </label>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Activer l’envoi vers Gotify
          </label>
          <div className="section-toolbar">
            <button
              type="button"
              disabled={busy || !url || (!configured && !token)}
              onClick={() =>
                void run(
                  () =>
                    api("/api/v1/gotify", "PUT", {
                      url,
                      token: token || undefined,
                      enabled,
                    }),
                  "Configuration Gotify enregistrée.",
                  true,
                )
              }
            >
              Enregistrer Gotify
            </button>
            <button
              type="button"
              disabled={busy || !configured || !enabled || !base}
              onClick={() =>
                void run(
                  () =>
                    api("/api/v1/gotify/test", "POST", {
                      workspace: base.split("/").at(-1),
                    }),
                  "Test en file d’envoi. Consultez son état ci-dessous.",
                )
              }
            >
              Envoyer un test
            </button>
            {configured && (
              <button
                type="button"
                disabled={busy}
                className="danger"
                onClick={() => {
                  if (
                    confirm(
                      "Déconnecter Gotify et supprimer les envois en attente ?",
                    )
                  )
                    void run(
                      () => api("/api/v1/gotify", "DELETE"),
                      "Gotify déconnecté.",
                      true,
                    );
                }}
              >
                <Trash2 size={14} />
                Déconnecter
              </button>
            )}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {status && <p role="status">{status}</p>}
      <details className="gotify-history">
        <summary>
          Envois récents{deliveries.length ? ` (${deliveries.length})` : ""}
        </summary>
        <button type="button" disabled={busy} onClick={() => void load()}>
          <RefreshCw size={14} />
          Actualiser les envois
        </button>
        {!deliveries.length && (
          <p className="muted">Les prochains envois apparaîtront ici.</p>
        )}
        {deliveries.map((d) => (
          <div className="gotify-delivery" key={d.id}>
            <div>
              <strong>
                {
                  {
                    pending: "En attente",
                    sent: "Envoyé",
                    failed: "Échec",
                    cancelled: "Annulé",
                  }[d.state]
                }
              </strong>
              <small>
                {new Date(d.created_at).toLocaleString("fr-FR")} · {d.attempts}{" "}
                essais{d.last_error && ` · ${d.last_error}`}
              </small>
            </div>
            {d.state === "failed" && (
              <button
                type="button"
                disabled={busy || !enabled}
                onClick={() =>
                  void run(
                    () =>
                      api(
                        `/api/v1/gotify/deliveries/${d.id}/retry`,
                        "POST",
                        {},
                      ),
                    "Nouvel essai planifié.",
                  )
                }
              >
                Réessayer
              </button>
            )}
            {["pending", "failed"].includes(d.state) && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () =>
                      api(
                        `/api/v1/gotify/deliveries/${d.id}/cancel`,
                        "POST",
                        {},
                      ),
                    "Envoi annulé.",
                  )
                }
              >
                Annuler
              </button>
            )}
          </div>
        ))}
      </details>
    </section>
  );
}
