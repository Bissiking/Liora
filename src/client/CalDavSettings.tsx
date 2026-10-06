// src/client/CalDavSettings.tsx
import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { api } from "./api";
type Device = { id: string; name: string; last_used_at: string | null };
type Dav = { data: Device[]; server_url: string; username: string };
export function CalDavSettings() {
  const [dav, setDav] = useState<Dav | null>(null),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = () => api<Dav>("/api/v1/calendar-sync").then(setDav);
  useEffect(() => {
    let gone = false;
    void api<Dav>("/api/v1/calendar-sync")
      .then((r) => {
        if (!gone) setDav(r);
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, []);
  async function run(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const copy = (value: string) =>
    void navigator.clipboard
      .writeText(value)
      .then(() => setNotice("Valeur copiée."))
      .catch(() =>
        setError("La copie a échoué. Sélectionnez la valeur pour la copier."),
      );
  const field = (label: string, value: string) => (
    <label className="copy-field">
      <span>{label}</span>
      <div>
        <input readOnly value={value} />
        <button
          aria-label={`Copier ${label.toLowerCase()}`}
          onClick={() => copy(value)}
        >
          <Copy size={17} />
        </button>
      </div>
    </label>
  );
  return (
    <section className="caldav-settings">
      <header>
        <h2>Calendrier externe avec CalDAV</h2>
        <p>
          Ajoutez Liora à votre application de calendrier. Les événements
          restent modifiables selon vos droits ; vos notes datées sont en
          lecture seule.
        </p>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!dav && !error ? (
        <p role="status">Chargement des accès…</p>
      ) : (
        dav && (
          <>
            <div className="sync-fields">
              {field("Serveur", dav.server_url)}
              {field("Identifiant", dav.username)}
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
                  setNotice(
                    "Accès créé. Conservez son mot de passe avant de le masquer.",
                  );
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
              <button
                className="primary"
                disabled={busy || !name.trim() || dav.data.length >= 10}
              >
                <Plus size={17} />
                Créer un accès
              </button>
            </form>
            {password && (
              <div className="caldav-password">
                <p>Ce mot de passe est affiché une seule fois.</p>
                {field("Mot de passe", password)}
                <button onClick={() => setPassword("")}>
                  J’ai conservé le mot de passe
                </button>
              </div>
            )}
            <h3>Vos appareils · {dav.data.length}/10</h3>
            {!dav.data.length ? (
              <p className="muted">Aucun accès créé.</p>
            ) : (
              <div className="caldav-devices">
                {dav.data.map((d) => (
                  <article key={d.id}>
                    <div>
                      <strong>{d.name}</strong>
                      <small>
                        {d.last_used_at
                          ? `Dernière utilisation : ${new Date(d.last_used_at).toLocaleString("fr-FR")}`
                          : "Pas encore utilisé"}
                      </small>
                    </div>
                    <button
                      className="danger"
                      disabled={busy}
                      aria-label={`Révoquer ${d.name}`}
                      onClick={() => {
                        if (confirm(`Révoquer l’accès de ${d.name} ?`))
                          void run(() =>
                            api(`/api/v1/calendar-sync/${d.id}`, "DELETE"),
                          );
                      }}
                    >
                      <Trash2 size={17} />
                      Révoquer
                    </button>
                  </article>
                ))}
              </div>
            )}
          </>
        )
      )}
      <h3>Configurer votre application</h3>
      <div className="caldav-guides">
        <details>
          <summary>iOS et iPadOS</summary>
          <p>
            Réglages → Apps → Calendrier → Comptes de calendrier → Ajouter un
            compte → Autre → Ajouter un compte CalDAV. Saisissez le serveur,
            l’identifiant et le mot de passe de cet appareil.
          </p>
        </details>
        <details>
          <summary>macOS et Apple Calendar</summary>
          <p>
            Calendrier → Ajouter un compte → Autre compte CalDAV → Type de
            compte Manuel. Renseignez le serveur, l’identifiant et le mot de
            passe.
          </p>
        </details>
        <details>
          <summary>Thunderbird</summary>
          <p>
            Agenda → Nouvel agenda → Sur le réseau. Saisissez l’identifiant et
            l’URL du serveur, puis sélectionnez les calendriers découverts et
            renseignez le mot de passe.
          </p>
        </details>
        <details>
          <summary>Android avec un client DAV</summary>
          <p>
            Ajoutez un compte dans un client compatible, par exemple DAVx⁵, en
            choisissant la connexion par URL et identifiant. Copiez les trois
            valeurs, puis activez les calendriers souhaités. Votre application
            de calendrier Android peut ensuite afficher ce compte.
          </p>
        </details>
      </div>
      <p className="muted">
        Un accès par appareil facilite la révocation. Pour retrouver un mot de
        passe oublié, révoquez cet accès puis créez-en un nouveau.
      </p>
    </section>
  );
}
