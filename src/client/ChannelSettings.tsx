// src/client/ChannelSettings.tsx
import { useEffect, useState } from "react";
import {
  Hash,
  Shield,
  SlidersHorizontal,
  Plug,
  LockKeyhole,
} from "lucide-react";
import { api, collection } from "./api";
import { Modal } from "./ui";
import { ChannelAccess } from "./Collaboration";
import { channelPermissions } from "../shared/channel-permissions";
import type { Row } from "./types";
export function ChannelSettings({
  base,
  channel,
  can,
  close,
  refresh,
}: {
  base: string;
  channel: Row;
  can: (p: string) => boolean;
  close: () => void;
  refresh: () => void;
}) {
  const readable =
    channel.capabilities?.includes("READ_MESSAGE") ?? can("READ_MESSAGE");
  const [tab, setTab] = useState("general"),
    [draft, setDraft] = useState(channel),
    [roles, setRoles] = useState<Row[]>([]),
    [members, setMembers] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [webhooks, setWebhooks] = useState<Row[]>([]),
    [integrations, setIntegrations] = useState<
      Array<Row & { provider: string }>
    >([]),
    [following, setFollowing] = useState(false),
    [overrides, setOverrides] = useState<
      Array<{
        role_id: string | null;
        user_id: string | null;
        permissions: Record<string, boolean>;
      }>
    >([]),
    [subject, setSubject] = useState(""),
    [grants, setGrants] = useState<Record<string, boolean>>({}),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = async () => {
    const [settings, r, m, c, follow] = await Promise.all([
      api<{
        data: Row;
        overrides: typeof overrides;
        webhooks: Row[];
        integrations: Array<Row & { provider: string }>;
      }>(`${base}/channels/${channel.id}/settings`),
      collection(`${base}/roles`),
      collection(`${base}/members`),
      collection(`${base}/categories`),
      readable
        ? api<{ data: { following: boolean } }>(
            `${base}/channels/${channel.id}/follow`,
          )
        : Promise.resolve({ data: { following: false } }),
    ]);
    setDraft(settings.data);
    setOverrides(settings.overrides);
    setRoles(r.data.filter((r) => !r.is_owner));
    setMembers(m.data.filter((m) => !m.is_owner && m.state === "active"));
    setCategories(c.data);
    setWebhooks(settings.webhooks);
    setIntegrations(settings.integrations);
    setFollowing(follow.data.following);
  };
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [base, channel.id]);
  const run = async (task: () => Promise<unknown>, reload = true) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      if (reload) await load();
      refresh();
      setNotice("Paramètres enregistrés.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pick = (s: string) => {
    setSubject(s);
    const [type, id] = s.split(":");
    setGrants(
      overrides.find((o) =>
        type === "role" ? o.role_id === id : o.user_id === id,
      )?.permissions || {},
    );
  };
  return (
    <Modal
      title="Paramètres du canal"
      onClose={close}
      className="channel-settings"
    >
      <div className="channel-settings-layout">
        <nav className="channel-settings-nav" aria-label="Paramètres du canal">
          <div className="settings-channel-name">
            <Hash size={18} />
            <strong>{channel.name}</strong>
          </div>
          {[
            ["general", "Général"],
            ["permissions", "Permissions"],
            ["options", "Options"],
            ["connections", "Connexions"],
            ["access", "Accès privés"],
          ]
            .filter(([id]) => id !== "permissions" || can("MANAGE_PERMISSIONS"))
            .filter(
              ([id]) =>
                id !== "access" || (channel.is_private && !channel.is_dm),
            )
            .map(([id, label]) => (
              <button
                key={id}
                aria-current={!loading && tab === id ? "page" : undefined}
                onClick={() => setTab(id)}
              >
                {id === "general" ? (
                  <Hash size={17} />
                ) : id === "permissions" ? (
                  <Shield size={17} />
                ) : id === "options" ? (
                  <SlidersHorizontal size={17} />
                ) : id === "connections" ? (
                  <Plug size={17} />
                ) : (
                  <LockKeyhole size={17} />
                )}
                {label}
              </button>
            ))}
        </nav>
        <div className="channel-settings-content">
          <div className="settings-intro">
            <h3>
              {
                {
                  general: "Un canal facile à retrouver",
                  permissions: "Qui peut faire quoi ?",
                  options: "Le rythme des échanges",
                  connections: "Les outils de ce canal",
                  access: "Un accès sur invitation",
                }[tab]
              }
            </h3>
            <p>
              {
                {
                  general:
                    "Donnez-lui un nom clair et une place dans votre espace.",
                  permissions:
                    "Adaptez les droits d’un rôle ou d’un membre pour ce canal.",
                  options:
                    "Réglez la fréquence des messages et les fils de discussion.",
                  connections:
                    "Retrouvez les webhooks et intégrations qui alimentent ce canal.",
                  access:
                    "Choisissez les membres et groupes autorisés à rejoindre ce canal.",
                }[tab]
              }
            </p>
          </div>
          {loading && <p role="status">Chargement des paramètres…</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="settings-notice" role="status">
              {notice}
            </p>
          )}
          {!loading && tab === "general" && (
            <form
              className="form settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  api(`${base}/channels/${channel.id}`, "PATCH", {
                    name: draft.name,
                    description: draft.description,
                    category_id: draft.category_id,
                    position: draft.position,
                    type: draft.type,
                    is_private: draft.is_private,
                    archived: draft.archived,
                  }),
                );
              }}
            >
              <fieldset className="settings-form-fields" disabled={busy}>
                <fieldset disabled={busy}>
                  <legend>Identité du canal</legend>
                  <label>
                    Nom du canal
                    <input
                      required
                      maxLength={100}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      maxLength={8000}
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                </fieldset>
                <fieldset disabled={busy}>
                  <legend>Organisation</legend>
                  <div className="settings-field-pair">
                    <label>
                      Catégorie
                      <select
                        value={draft.category_id || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            category_id: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Sans catégorie</option>
                        {categories.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Ordre
                      <input
                        type="number"
                        value={draft.position}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            position: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <fieldset disabled={busy}>
                  <legend>Fonctionnement et accès</legend>
                  <div className="settings-field-pair">
                    <label>
                      Type de canal
                      <select
                        value={draft.type}
                        onChange={(e) =>
                          setDraft({ ...draft, type: e.target.value })
                        }
                      >
                        {[
                          ["text", "Discussion"],
                          ["announcement", "Annonces"],
                          ["project", "Projet"],
                          ...(can("MANAGE_MONITORING")
                            ? [["monitoring", "Supervision"]]
                            : []),
                        ].map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Visibilité
                      <select
                        value={String(!!draft.is_private)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            is_private: e.target.value === "true",
                          })
                        }
                      >
                        <option value="false">Public</option>
                        <option value="true">Privé</option>
                      </select>
                    </label>
                  </div>
                  <p className="settings-help">
                    Un canal public est visible par les membres autorisés de cet
                    espace. Un canal privé exige aussi un accès explicite.
                  </p>
                </fieldset>
                <label className="checkbox settings-toggle settings-archive">
                  <input
                    type="checkbox"
                    checked={draft.archived}
                    onChange={(e) =>
                      setDraft({ ...draft, archived: e.target.checked })
                    }
                  />
                  <span>
                    <strong>Archiver le canal</strong>
                    <small>
                      Le retirer de la navigation en conservant son historique.
                    </small>
                  </span>
                </label>
              </fieldset>
              <div className="settings-form-actions">
                <button type="button" onClick={close}>
                  Fermer
                </button>
                <button className="primary" disabled={busy}>
                  {busy ? "Enregistrement…" : "Enregistrer"}
                </button>
              </div>
            </form>
          )}
          {!loading && tab === "options" && (
            <form
              className="form settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  api(`${base}/channels/${channel.id}/options`, "PATCH", {
                    slowmode_seconds: Number(draft.slowmode_seconds || 0),
                    threads_enabled: draft.threads_enabled !== false,
                  }),
                );
              }}
            >
              <fieldset className="settings-form-fields" disabled={busy}>
                <label>
                  Délai entre deux messages (secondes)
                  <input
                    type="number"
                    min="0"
                    max="21600"
                    value={draft.slowmode_seconds || 0}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        slowmode_seconds: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <p className="muted">
                  0 autorise l’envoi sans délai. Les gestionnaires du canal en
                  sont exemptés.
                </p>
                <label className="checkbox settings-toggle">
                  <input
                    type="checkbox"
                    checked={draft.threads_enabled !== false}
                    onChange={(e) =>
                      setDraft({ ...draft, threads_enabled: e.target.checked })
                    }
                  />
                  <span>
                    <strong>Autoriser les fils de discussion</strong>
                    <small>
                      Poursuivre un sujet sans encombrer la conversation
                      principale.
                    </small>
                  </span>
                </label>
                {readable && (
                  <label className="checkbox settings-toggle">
                    <input
                      type="checkbox"
                      checked={following}
                      disabled={busy}
                      onChange={(e) => {
                        const next = e.target.checked;
                        void run(async () => {
                          await api(
                            `${base}/channels/${channel.id}/follow`,
                            "PUT",
                            { following: next, muted: false },
                          );
                          setFollowing(next);
                        }, false);
                      }}
                    />
                    <span>
                      <strong>Suivre ce canal</strong>
                      <small>
                        Recevoir les nouveaux messages dans ma boîte de
                        réception.
                      </small>
                    </span>
                  </label>
                )}
              </fieldset>
              <div className="settings-form-actions">
                <button className="primary" disabled={busy}>
                  Enregistrer les options
                </button>
              </div>
            </form>
          )}
          {!loading && tab === "connections" && (
            <section className="settings-connections">
              <h4>Webhooks liés</h4>
              {can("VIEW_WEBHOOKS") ? (
                webhooks.length ? (
                  webhooks.map((h) => (
                    <p key={h.id}>
                      {h.name} · {h.revoked ? "Révoqué" : "Actif"}
                    </p>
                  ))
                ) : (
                  <p>Aucun webhook lié à ce canal.</p>
                )
              ) : (
                <p>Vous n’avez pas accès aux webhooks de cet espace.</p>
              )}
              <h4>Intégrations liées</h4>
              {can("MANAGE_WORKSPACE") && can("MANAGE_WEBHOOK") ? (
                integrations.length ? (
                  integrations.map((i) => (
                    <p key={i.id}>
                      {i.name} · {i.provider} ·{" "}
                      {i.enabled ? "Activée" : "Désactivée"}
                    </p>
                  ))
                ) : (
                  <p>Aucune intégration liée à ce canal.</p>
                )
              ) : (
                <p>Vous n’avez pas accès aux intégrations de cet espace.</p>
              )}
            </section>
          )}
          {!loading && tab === "permissions" && (
            <form
              className="form settings-form"
              onSubmit={(e) => {
                e.preventDefault();
                const [kind, id] = subject.split(":");
                void run(() =>
                  api(`${base}/channels/${channel.id}/permissions`, "PUT", {
                    role_id: kind === "role" ? id : null,
                    user_id: kind === "user" ? id : null,
                    permissions: grants,
                  }),
                );
              }}
            >
              <fieldset className="settings-form-fields" disabled={busy}>
                <label>
                  Rôle ou exception individuelle
                  <select
                    required
                    value={subject}
                    onChange={(e) => pick(e.target.value)}
                  >
                    <option value="">Choisir…</option>
                    <optgroup label="Rôles">
                      {roles.map((r) => (
                        <option key={r.id} value={`role:${r.id}`}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Membres">
                      {members.map((m) => (
                        <option key={m.id} value={`user:${m.id}`}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <p className="muted">
                  Hériter conserve le niveau précédent. Une exception
                  individuelle suit le rôle. Les accès privés et les
                  participants des DMs restent obligatoires.
                </p>
                {Object.entries(channelPermissions).map(([key, label]) => (
                  <label key={key} className="permission-row">
                    <span>{label}</span>
                    <select
                      disabled={!subject}
                      value={key in grants ? String(grants[key]) : "inherit"}
                      onChange={(e) =>
                        setGrants((old) => {
                          const next = { ...old };
                          if (e.target.value === "inherit") delete next[key];
                          else next[key] = e.target.value === "true";
                          return next;
                        })
                      }
                    >
                      <option value="inherit">Hériter</option>
                      <option value="true">Autoriser</option>
                      <option value="false">Refuser</option>
                    </select>
                  </label>
                ))}
              </fieldset>
              <div className="settings-form-actions">
                <button className="primary" disabled={busy || !subject}>
                  Enregistrer les permissions
                </button>
              </div>
            </form>
          )}
          {!loading && tab === "access" && (
            <ChannelAccess
              embedded
              base={base}
              channel={channel}
              close={() => setTab("general")}
              refresh={refresh}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
