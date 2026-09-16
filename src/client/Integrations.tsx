// src/client/Integrations.tsx
import { useEffect, useState, type FormEvent } from "react";
import { api, collection } from "./api";
import { Modal } from "./ui";
import type { Row } from "./types";
type Connector = {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  state: string;
  has_key: boolean;
  last_error?: string;
  config: { base_url: string; client_id: string; allow_private: boolean };
};
type Rule = {
  id: string;
  name: string;
  event_pattern: string;
  severity: string;
  channel_id: string;
  column_id?: string;
};
const providers = [
  ["dropit", "DropIt · fichiers personnels"],
  ["github", "GitHub · dépôts et déploiements"],
  ["nino", "Nino · médias et traitement"],
  ["narra", "Narra · histoires et publications"],
  ["argos", "Argos · événements"],
  ["generic", "Autre module LUMA"],
];
export function Integrations({
  base,
  fail,
}: {
  base: string;
  fail: (e: unknown) => void;
}) {
  const [newProvider, setNewProvider] = useState("dropit");
  const [signatureMode, setSignatureMode] = useState("liora");
  const [rows, setRows] = useState<Connector[]>([]),
    [channels, setChannels] = useState<Row[]>([]),
    [columns, setColumns] = useState<Row[]>([]),
    [selected, setSelected] = useState<Connector | null>(null),
    [adding, setAdding] = useState(false),
    [rules, setRules] = useState<Rule[]>([]),
    [secret, setSecret] = useState<{
      incoming_url: string;
      signing_secret: string | null;
    } | null>(null),
    [callback, setCallback] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const isDropIt = (selected?.provider || newProvider) === "dropit";
  async function load() {
    const r = await api<{ data: Connector[]; callback_url: string }>(
      `${base}/connectors`,
    );
    setRows(r.data);
    setCallback(r.callback_url);
    if (selected) setSelected(r.data.find((i) => i.id === selected.id) || null);
  }
  useEffect(() => {
    void load().catch(fail);
    void collection(`${base}/channels`)
      .then((r) => setChannels(r.data.filter((c) => !c.is_dm && !c.archived)))
      .catch(fail);
    void collection(`${base}/columns`)
      .then((r) => setColumns(r.data))
      .catch(() => {});
  }, [base]);
  useEffect(() => {
    if (selected)
      void api<{ data: Rule[] }>(`${base}/connectors/${selected.id}/rules`)
        .then((r) => setRules(r.data))
        .catch(fail);
    else setRules([]);
  }, [selected?.id]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    void run(async () => {
      const body = {
        name: String(d.get("name")),
        config: {
          base_url: String(d.get("base_url")).replace(/\/$/, ""),
          client_id: String(d.get("client_id") || ""),
          allow_private: d.get("allow_private") === "on",
        },
        ...(d.get("api_key") ? { api_key: String(d.get("api_key")) } : {}),
      };
      if (selected) {
        await api(`${base}/connectors/${selected.id}`, "PATCH", body);
        setNotice(
          isDropIt
            ? "Configuration enregistrée. Testez-la avant de reconnecter les comptes."
            : "Configuration enregistrée. Vous pouvez tester la connexion au module.",
        );
      } else {
        const r = await api<{
          data: Connector;
          incoming_url: string;
          signing_secret: string;
        }>(`${base}/connectors`, "POST", {
          ...body,
          provider: d.get("provider"),
          channel_id: d.get("channel_id"),
        });
        setSecret(r);
        setSelected(r.data);
        setAdding(false);
      }
      await load();
    });
  }
  return (
    <div className="integrations-panel">
      <p>
        Connectez vos modules, puis choisissez où leurs événements doivent
        arriver.
      </p>
      <div className="integration-list">
        {rows.map((i) => (
          <button
            key={i.id}
            aria-pressed={selected?.id === i.id}
            onClick={() => {
              setSelected(i);
              setAdding(false);
              setSecret(null);
              setNotice("");
            }}
          >
            <strong>{i.name}</strong>
            <span>
              {i.provider} ·{" "}
              {!i.enabled
                ? "Désactivé"
                : i.state === "connected"
                  ? "Connexion vérifiée"
                  : i.state === "error"
                    ? "À vérifier"
                    : "À configurer"}
            </span>
          </button>
        ))}
        <button
          onClick={() => {
            setSelected(null);
            setAdding(true);
            setNewProvider("dropit");
            setSecret(null);
          }}
        >
          Ajouter un module
        </button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {(adding || selected) && (
        <form
          className="form connector-form"
          key={selected?.id || "new"}
          onSubmit={save}
        >
          <h2>{selected ? "Configuration du module" : "Nouveau module"}</h2>
          <label>
            Nom
            <input
              name="name"
              defaultValue={selected?.name}
              required
              maxLength={80}
            />
          </label>
          {!selected && (
            <label>
              Fournisseur
              <select
                name="provider"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
              >
                {providers.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            URL du module
            <input
              name="base_url"
              type="url"
              defaultValue={selected?.config.base_url}
              placeholder={
                isDropIt
                  ? "https://dropit.exemple.fr"
                  : "https://service.exemple.fr"
              }
              required
            />
          </label>
          {isDropIt && (
            <label>
              Identifiant du client DropIt
              <input
                name="client_id"
                defaultValue={selected?.config.client_id}
              />
            </label>
          )}
          <label>
            Clé API{selected?.has_key ? " · déjà enregistrée" : ""}
            <input
              name="api_key"
              type="password"
              autoComplete="new-password"
              minLength={16}
              placeholder={selected ? "Laisser vide pour conserver la clé" : ""}
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              name="allow_private"
              defaultChecked={selected?.config.allow_private}
            />
            Autoriser une adresse privée (droit de sécurité requis)
          </label>
          {!selected && (
            <label>
              Salon par défaut
              <select name="channel_id" required>
                {channels.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isDropIt ? (
            <>
              <p className="muted">
                Dans DropIt → Applications connectées, créez une clé avec cette
                URL de retour :
              </p>
              <input
                aria-label="URL de retour DropIt"
                value={callback}
                readOnly
              />
              <p className="muted">
                Modifier l’URL, le client ou la clé déconnecte les comptes
                personnels. Les clés restent côté serveur.
              </p>
            </>
          ) : (
            <p className="muted">
              Les clés restent côté serveur. Après création, configurez l’URL
              entrante et le secret dans le service émetteur.
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Enregistrement…" : "Enregistrer le module"}
          </button>
        </form>
      )}
      {selected && (
        <>
          {selected.provider !== "github" && (
            <label>
              Signature au prochain renouvellement
              <select
                aria-label="Signature entrante"
                value={signatureMode}
                onChange={(e) => setSignatureMode(e.target.value)}
              >
                <option value="liora">HMAC horodaté (recommandé)</option>
                <option value="none">URL secrète uniquement</option>
              </select>
            </label>
          )}
          <div className="integration-actions">
            <button
              disabled={busy || !selected.enabled}
              onClick={() =>
                void run(async () => {
                  await api(
                    `${base}/connectors/${selected.id}/test`,
                    "POST",
                    {},
                  );
                  await load();
                  setNotice("Connexion vérifiée.");
                })
              }
            >
              Tester la connexion
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api(`${base}/connectors/${selected.id}`, "PATCH", {
                    enabled: !selected.enabled,
                  });
                  await load();
                })
              }
            >
              {selected.enabled ? "Désactiver" : "Activer"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    "Remplacer l’URL et la clé entrantes ? Les émetteurs devront être mis à jour.",
                  )
                )
                  void run(async () =>
                    setSecret(
                      await api(
                        `${base}/connectors/${selected.id}/incoming-key`,
                        "POST",
                        {
                          signature_mode:
                            selected.provider === "github"
                              ? "github"
                              : signatureMode,
                        },
                      ),
                    ),
                  );
              }}
            >
              Renouveler la clé entrante
            </button>
          </div>
          {selected.last_error && <p role="status">{selected.last_error}</p>}
          <h2>Routage et automatisations</h2>
          <p className="muted">
            Sans règle, les événements vont au salon par défaut. Dès qu’une
            règle existe, seuls les événements correspondants sont publiés. Une
            colonne ajoute une tâche.
          </p>
          {rules.map((r) => (
            <div className="integration-rule" key={r.id}>
              <div>
                <strong>{r.name}</strong>
                <p>
                  {r.event_pattern}
                  {r.severity ? ` · ${r.severity}` : ""} →{" "}
                  {channels.find((c) => c.id === r.channel_id)?.name || "Salon"}
                  {r.column_id ? " + tâche" : ""}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(
                      `${base}/connectors/${selected.id}/rules/${r.id}`,
                      "DELETE",
                    );
                    setRules(rules.filter((x) => x.id !== r.id));
                  })
                }
              >
                Supprimer
              </button>
            </div>
          ))}
          <form
            className="form connector-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = new FormData(f);
              void run(async () => {
                const r = await api<{ data: Rule }>(
                  `${base}/connectors/${selected.id}/rules`,
                  "POST",
                  {
                    name: d.get("name"),
                    event_pattern: d.get("event_pattern"),
                    severity: d.get("severity"),
                    channel_id: d.get("channel_id"),
                    column_id: d.get("column_id") || null,
                  },
                );
                setRules([...rules, r.data]);
                f.reset();
                setNotice("Règle ajoutée.");
              });
            }}
          >
            <label>
              Nom de la règle
              <input name="name" required maxLength={80} />
            </label>
            <label>
              Événement
              <input
                name="event_pattern"
                required
                placeholder="github.issues.*"
              />
            </label>
            <label>
              Importance
              <select name="severity">
                <option value="">Toutes</option>
                {["info", "warning", "error", "critical"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Publier dans
              <select name="channel_id">
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Créer aussi une tâche
              <select name="column_id">
                <option value="">Aucune tâche</option>
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy}>Ajouter la règle</button>
          </form>
        </>
      )}
      <MonitoringConfiguration base={base} fail={fail} />
      {secret && (
        <Modal title="Accès entrant du module" onClose={() => setSecret(null)}>
          <div className="integration-dialog-body">
            <p>
              Copiez ces valeurs dans le module émetteur. La clé n’est affichée
              qu’une fois.
            </p>
            <label>
              URL du webhook
              <input value={secret.incoming_url} readOnly />
            </label>
            <label>
              Secret de signature
              <input value={secret.signing_secret || ""} readOnly />
            </label>
            <p>
              GitHub : secret du webhook et signature SHA-256. Modules LUMA :
              signature HMAC sur l’horodatage et le corps JSON. Le guide API
              décrit le format.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
type Connection = {
  id: string;
  name: string;
  enabled: boolean;
  connected: boolean;
  state: string;
};
type RemoteFile = {
  id: string;
  share_id: string;
  name: string;
  size: number;
  expires_at: string;
};
export function ConnectedAccounts({
  base,
  fail,
  pick,
}: {
  base: string;
  fail: (e: unknown) => void;
  pick?: (url: string) => void;
}) {
  const [rows, setRows] = useState<Connection[]>([]),
    [selected, setSelected] = useState(""),
    [files, setFiles] = useState<RemoteFile[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<RemoteFile | null>(null);
  const load = () =>
    api<{ data: Connection[] }>(`${base}/connections`).then((r) =>
      setRows(r.data),
    );
  useEffect(() => {
    void load().catch(fail);
  }, [base]);
  async function list(id: string, after?: string) {
    setBusy(true);
    try {
      const r = await api<{ data: RemoteFile[]; nextCursor: string | null }>(
        `${base}/connections/${id}/files${after ? "?after=" + encodeURIComponent(after) : ""}`,
      );
      setSelected(id);
      setFiles(after ? [...files, ...r.data] : r.data);
      setCursor(r.nextCursor);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="connected-accounts">
      <p>
        Vos fichiers restent personnels. Choisir un lien de partage vous permet
        ensuite de le publier.
      </p>
      {!rows.length && (
        <p className="muted">
          Aucun module DropIt configuré. Un administrateur peut l’ajouter dans
          Intégrations.
        </p>
      )}
      {rows.map((r) => (
        <article className="integration-rule" key={r.id}>
          <div>
            <strong>{r.name}</strong>
            <p>
              {!r.enabled
                ? "Module désactivé"
                : r.connected
                  ? "Compte connecté"
                  : "Compte personnel à connecter"}
            </p>
          </div>
          <div className="integration-actions">
            {r.connected ? (
              <>
                <button
                  disabled={busy || !r.enabled}
                  onClick={() => void list(r.id)}
                >
                  Mes fichiers
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void api(`${base}/connections/${r.id}`, "DELETE")
                      .then(() => {
                        setFiles([]);
                        setSelected("");
                        return load();
                      })
                      .catch(fail)
                      .finally(() => setBusy(false));
                  }}
                >
                  Déconnecter
                </button>
              </>
            ) : (
              <button
                disabled={busy || !r.enabled || r.state !== "connected"}
                onClick={() => {
                  setBusy(true);
                  void api<{ url: string }>(
                    `${base}/connections/${r.id}/start`,
                    "POST",
                    {},
                  )
                    .then((r) => location.assign(r.url))
                    .catch(fail)
                    .finally(() => setBusy(false));
                }}
              >
                Connecter mon compte
              </button>
            )}
          </div>
        </article>
      ))}
      {selected && (
        <>
          <h2>Mes fichiers DropIt</h2>
          {!files.length && !busy && (
            <p>
              Aucun fichier dans vos partages actifs. Ajoutez des fichiers dans
              DropIt.
            </p>
          )}
          {files.map((f) => (
            <article className="integration-rule" key={f.id}>
              <div>
                <strong>{f.name}</strong>
                <p>
                  {(f.size / 1_000_000).toLocaleString("fr-FR", {
                    maximumFractionDigits: 2,
                  })}{" "}
                  Mo · expire le{" "}
                  {new Date(f.expires_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <button disabled={busy} onClick={() => setPending(f)}>
                {pick ? "Insérer le partage" : "Obtenir le lien"}
              </button>
            </article>
          ))}
          {cursor && (
            <button disabled={busy} onClick={() => void list(selected, cursor)}>
              Charger la suite
            </button>
          )}
        </>
      )}
      {pending && (
        <Modal title="Partager ce fichier" onClose={() => setPending(null)}>
          <div className="integration-dialog-body">
            <p>
              <strong>{pending.name}</strong>
            </p>
            <p>
              Le lien DropIt donne accès à tous les fichiers de ce partage à
              toute personne qui le possède, jusqu’à son expiration. Les droits
              du salon Liora ne protègent pas ce lien.
            </p>
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void api<{ url: string }>(
                  `${base}/connections/${selected}/shares/${pending.share_id}/link`,
                  "POST",
                  {},
                )
                  .then(async (r) => {
                    if (pick) pick(r.url);
                    else await navigator.clipboard.writeText(r.url);
                    setPending(null);
                  })
                  .catch(fail)
                  .finally(() => setBusy(false));
              }}
            >
              {pick
                ? "Insérer le lien dans mon brouillon"
                : "Copier le lien de partage"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MonitoringConfiguration({
  base,
  fail,
}: {
  base: string;
  fail: (e: unknown) => void;
}) {
  const [targets, setTargets] = useState<
      { id: string; name: string; kind: string; url: string }[]
    >([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ data: typeof targets }>(`${base}/monitoring-settings`)
      .then((r) => setTargets(r.data.filter((t) => t.kind === "http")))
      .catch(() => {});
  }, [base]);
  return targets.length ? (
    <section className="monitoring-configuration">
      <h2>Connexions de supervision</h2>
      <p className="muted">
        Ces adresses sont enregistrées en base et utilisées au prochain
        contrôle. Les adresses internes exigent les droits de sécurité.
      </p>
      {targets.map((t) => (
        <form
          className="form connector-form"
          key={t.id}
          onSubmit={(e) => {
            e.preventDefault();
            const url = new FormData(e.currentTarget).get("url");
            setBusy(true);
            void api(`${base}/monitoring-settings/${t.id}`, "PATCH", { url })
              .then(() => setNotice("Adresse enregistrée."))
              .catch(fail)
              .finally(() => setBusy(false));
          }}
        >
          <label>
            {t.name}
            <input
              name="url"
              type="url"
              defaultValue={t.url || ""}
              placeholder="https://service.exemple.fr/health"
            />
          </label>
          <button disabled={busy}>Enregistrer l’adresse</button>
        </form>
      ))}
      {notice && <p role="status">{notice}</p>}
    </section>
  ) : null;
}
