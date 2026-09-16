// src/client/Admin.tsx
import { VERSION } from "../shared/version";
import { useEffect, useState, useRef } from "react";
import {
  Users,
  Shield,
  Hash,
  FolderKanban,
  Bot,
  Webhook,
  Activity,
  ScrollText,
  Flag,
  Settings,
  Plus,
  KeyRound,
  Trash2,
  Pencil,
  Copy,
  Database,
  Smile,
  ArrowRight,
} from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result, Workspace } from "./types";
import { FormDialog, Modal, Empty, type Field } from "./ui";
import { Integrations } from "./Integrations";
import { Groups } from "./Groups";
export function Admin({
  base,
  workspace,
  can,
  refresh,
  fail,
  initialTab = "overview",
}: {
  initialTab?: string;
  base: string;
  workspace: Workspace;
  can: (p: string) => boolean;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [tab, setTab] = useState(initialTab),
    [snapshot, setSnapshot] = useState<{ key: string; data: Row[] }>({
      key: "",
      data: [],
    }),
    [roles, setRoles] = useState<Row[]>([]),
    [channels, setChannels] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [permissions, setPermissions] = useState<string[]>([]),
    [deliveries, setDeliveries] = useState<Row[]>([]),
    [loading, setLoading] = useState(false),
    [form, setForm] = useState<{
      title: string;
      fields: Field[];
      save: (d: Record<string, string>) => Promise<void>;
    } | null>(null),
    [secret, setSecret] = useState(""),
    [roleEditor, setRoleEditor] = useState<Row | null | undefined>(undefined),
    [copied, setCopied] = useState(false);
  const requestSequence = useRef(0);
  const resourceKey = `${base}/${tab}`;
  const rows = snapshot.key === resourceKey ? snapshot.data : [];
  const tabs = [
    ["overview", "Vue d’ensemble", Activity, "VIEW_AUDIT_LOG"],
    ["members", "Membres", Users, "MANAGE_MEMBERS"],
    ["groups", "Groupes", Users, "MANAGE_MEMBERS"],
    ["connectors", "Intégrations", Webhook, "MANAGE_WORKSPACE"],
    ["roles", "Rôles et permissions", Shield, "MANAGE_ROLES"],
    ["channels", "Salons", Hash, "MANAGE_CHANNEL"],
    ["categories", "Catégories", FolderKanban, "MANAGE_CHANNEL"],
    ["accounts", "Bots et services", Bot, "VIEW_BOTS"],
    ["webhooks", "Webhooks entrants", Webhook, "VIEW_WEBHOOKS"],
    ["outbound", "Webhooks sortants", ArrowRight, "VIEW_WEBHOOKS"],
    ["attachments", "Stockage", Database, "VIEW_AUDIT_LOG"],
    ["emojis", "Emojis", Smile, "MANAGE_EMOJIS"],
    ["audit", "Journal d’audit", ScrollText, "VIEW_AUDIT_LOG"],
    ["flags", "Feature flags", Flag, "MANAGE_FEATURE_FLAGS"],
    ["settings", "Espace de travail", Settings, "MANAGE_WORKSPACE"],
  ] as const;
  const load = async () => {
    const seq = ++requestSequence.current;
    setLoading(true);
    try {
      if (!["overview", "settings", "connectors"].includes(tab)) {
        const r = await api<Result>(`${base}/${tab}`);
        if (seq !== requestSequence.current) return;
        setSnapshot({ key: resourceKey, data: r.data });
        setNextCursor(r.nextCursor || null);
        setDeliveries(r.deliveries || []);
        if (r.permissions) setPermissions(r.permissions);
      } else setSnapshot({ key: resourceKey, data: [] });
    } catch (e) {
      if (seq === requestSequence.current) {
        setSnapshot({ key: resourceKey, data: [] });
        fail(e);
      }
    } finally {
      if (seq === requestSequence.current) setLoading(false);
    }
  };
  useEffect(() => {
    const available = tabs.filter(
      (t) => can(t[3]) && (t[0] !== "connectors" || can("MANAGE_WEBHOOK")),
    );
    if (!available.some((t) => t[0] === tab)) {
      setTab(available[0]?.[0] || "overview");
      return;
    }
    void load();
    return () => {
      requestSequence.current++;
    };
  }, [base, tab, workspace.permissions.join(",")]);
  useEffect(() => {
    void collection(`${base}/roles`)
      .then((r) => {
        setRoles(r.data);
        setPermissions(r.permissions || []);
      })
      .catch(fail);
    if (can("VIEW_CHANNEL"))
      void Promise.all([
        collection(`${base}/channels`),
        collection(`${base}/categories`),
      ])
        .then(([c, g]) => {
          setChannels(c.data);
          setCategories(g.data);
        })
        .catch(fail);
  }, [base]);
  const done = () => {
    void load();
    refresh();
  };
  const action = (path: string, method: string, body?: unknown) =>
    api<{ token?: string }>(`${base}/${path}`, method, body)
      .then((r) => {
        if (r.token) setSecret(r.token);
        done();
      })
      .catch(fail);
  const create = () => {
    if (tab === "roles") {
      setRoleEditor(null);
      return;
    }
    const fields: Field[] =
      tab === "members"
        ? [
            { key: "kyros_user_id", label: "Identifiant Kyros du membre" },
            {
              key: "role_id",
              label: "Rôle",
              options: roles
                .filter((r) => !r.is_owner)
                .map((r) => ({ value: r.id, label: r.name })),
            },
          ]
        : tab === "webhooks"
          ? [
              { key: "name", label: "Nom" },
              {
                key: "channel_id",
                label: "Salon de destination",
                options: channels.map((c) => ({
                  value: c.id,
                  label: `#${c.name}`,
                })),
              },
              {
                key: "allow_tasks",
                label: "Autoriser la création de tâches",
                options: [
                  { value: "false", label: "Non" },
                  { value: "true", label: "Oui" },
                ],
              },
            ]
          : tab === "outbound"
            ? [
                { key: "name", label: "Nom" },
                { key: "url", label: "URL HTTPS publique", type: "url" },
              ]
            : tab === "accounts"
              ? [
                  { key: "name", label: "Nom" },
                  {
                    key: "kind",
                    label: "Type",
                    options: [
                      { value: "bot", label: "Bot" },
                      { value: "service", label: "Service" },
                    ],
                  },
                  { key: "description", label: "Description", required: false },
                  {
                    key: "permissions",
                    label: "Permissions (séparées par des virgules)",
                    value:
                      "VIEW_WORKSPACE,VIEW_CHANNEL,SEND_MESSAGE,EDIT_OWN_MESSAGE,ADD_REACTION",
                  },
                ]
              : tab === "emojis"
                ? [
                    {
                      key: "name",
                      label: "Nom (lettres minuscules et tiret bas)",
                    },
                    {
                      key: "attachment_id",
                      label: "ID d’une image importée (voir Stockage)",
                    },
                  ]
                : [{ key: "name", label: "Nom" }];
    setForm({
      title: `Ajouter · ${tabs.find((t) => t[0] === tab)?.[1]}`,
      fields,
      save: async (d) => {
        const data: Record<string, unknown> = { ...d };
        if (tab === "accounts")
          data.permissions = d.permissions
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
        if (tab === "webhooks") data.allow_tasks = d.allow_tasks === "true";
        const r = await api<{ token?: string; url?: string; secret?: string }>(
          `${base}/${tab}`,
          "POST",
          data,
        );
        if (r.token || r.url || r.secret)
          setSecret(r.token || r.secret || r.url || "");
        done();
      },
    });
  };
  const editChannel = (r: Row) =>
    setForm({
      title: "Modifier le salon",
      fields: [
        { key: "name", label: "Nom", value: r.name },
        {
          key: "description",
          label: "Description",
          type: "textarea",
          value: r.description,
          required: false,
        },
        {
          key: "category_id",
          label: "Catégorie",
          value: r.category_id || "",
          options: [
            { value: "", label: "Sans catégorie" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ],
        },
        {
          key: "position",
          label: "Position",
          type: "number",
          value: String(r.position),
        },
        {
          key: "archived",
          label: "État",
          value: String(r.archived),
          options: [
            { value: "false", label: "Actif" },
            { value: "true", label: "Archivé" },
          ],
        },
      ],
      save: async (d) => {
        await api(`${base}/channels/${r.id}`, "PATCH", {
          ...d,
          position: Number(d.position),
          archived: d.archived === "true",
          category_id: d.category_id || null,
        });
        done();
      },
    });
  const editable = [
    "members",
    "roles",
    "channels",
    "categories",
    "accounts",
    "webhooks",
    "outbound",
    "emojis",
  ].includes(tab);
  return (
    <div className="admin-layout">
      <nav aria-label="Administration">
        <div className="admin-nav-heading">
          Administration<span>{VERSION} · BETA</span>
        </div>
        {tabs
          .filter(
            (t) =>
              can(t[3]) && (t[0] !== "connectors" || can("MANAGE_WEBHOOK")),
          )
          .map(([key, label, Icon]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              onClick={() => setTab(key)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
      </nav>
      <section className="admin-panel">
        <header className="page-heading">
          <div>
            <h1>{tabs.find((t) => t[0] === tab)?.[1]}</h1>
            <p>{workspace.name} · Les réglages qui font vivre l’espace.</p>
          </div>
          {editable && (
            <button className="primary" onClick={create}>
              <Plus size={16} />
              Ajouter
            </button>
          )}
        </header>
        {tab === "connectors" ? (
          <Integrations base={base} fail={fail} />
        ) : tab === "groups" ? (
          <Groups base={base} fail={fail} />
        ) : tab === "overview" ? (
          <>
            <div className="admin-welcome">
              <Shield size={35} />
              <h2>
                Un espace partagé.
                <br />
                Des accès bien définis.
              </h2>
              <p>
                Les rôles, les identités techniques et les intégrations se
                gèrent ici. Les actions importantes sont enregistrées dans le
                journal d’audit.
              </p>
            </div>
            <dl className="facts">
              <dt>Authentification</dt>
              <dd>Kyros SSO v4</dd>
              <dt>Autorisations</dt>
              <dd>Rôles locaux à {workspace.name}</dd>
              <dt>Sessions</dt>
              <dd>Refresh automatique · jetons chiffrés</dd>
              <dt>Version</dt>
              <dd>Liora {VERSION} — BETA</dd>
              <dt>Fonctions média</dt>
              <dd>Désactivées</dd>
            </dl>
          </>
        ) : tab === "settings" ? (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const d = Object.fromEntries(new FormData(e.currentTarget));
              void action("settings", "PATCH", d);
            }}
          >
            <label>
              Nom de l’espace
              <input name="name" defaultValue={workspace.name} required />
            </label>
            <label>
              Description
              <textarea
                name="description"
                defaultValue={workspace.description}
                rows={4}
              />
            </label>
            <button className="primary">Enregistrer</button>
          </form>
        ) : loading || snapshot.key !== resourceKey ? (
          <p className="muted">Chargement…</p>
        ) : !rows.length ? (
          <Empty title="La place est libre">
            Les éléments configurés apparaîtront ici.
          </Empty>
        ) : (
          <div className="admin-rows">
            {rows.map((r) => (
              <article key={r.id || r.key} className="admin-row">
                <div className="admin-row-main">
                  <strong>
                    {tab === "audit"
                      ? r.action
                      : tab === "flags"
                        ? r.key
                        : r.name || r.title}
                  </strong>
                  <p>
                    {tab === "members"
                      ? `${r.role_name} · ${r.state} · ${r.kyros_user_id}`
                      : tab === "roles"
                        ? `${(r.permissions || []).length} permissions${r.is_owner ? " · rôle protégé" : ""}`
                        : tab === "accounts"
                          ? `${r.kind} · ${r.revoked ? "révoqué" : "actif"} · ${(r.permissions || []).length} permissions`
                          : tab === "webhooks"
                            ? `${channels.find((c) => c.id === r.channel_id)?.name || "Salon"} · ${r.revoked ? "révoqué" : "actif"}`
                            : tab === "audit"
                              ? `${r.actor} → ${r.target}`
                              : tab === "attachments"
                                ? `${r.mime} · ${Math.round(r.size / 1000)} Ko · ${r.id}`
                                : tab === "flags"
                                  ? "Module prévu dans la roadmap. Activation indisponible en 0.1."
                                  : tab === "outbound"
                                    ? `${r.url} · ${r.enabled ? "actif" : "désactivé"}`
                                    : tab === "channels"
                                      ? `${r.description} ${r.archived ? "· archivé" : ""}`
                                      : r.description}
                  </p>
                  {r.created_at && (
                    <small>
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </small>
                  )}
                </div>
                <div className="row-actions">
                  {tab === "members" && !r.is_owner && (
                    <button
                      aria-label={`Modifier ${r.name}`}
                      onClick={() =>
                        setForm({
                          title: `Accès de ${r.name}`,
                          fields: [
                            {
                              key: "role_id",
                              label: "Rôle",
                              value: r.role_id,
                              options: roles
                                .filter((r) => !r.is_owner)
                                .map((r) => ({ value: r.id, label: r.name })),
                            },
                            {
                              key: "state",
                              label: "État",
                              value: r.state,
                              options: [
                                { value: "active", label: "Actif" },
                                { value: "disabled", label: "Désactivé" },
                                { value: "banned", label: "Banni" },
                              ],
                            },
                          ],
                          save: async (d) => {
                            await api(`${base}/members/${r.id}`, "PATCH", d);
                            done();
                          },
                        })
                      }
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {tab === "roles" && !r.is_owner && (
                    <button onClick={() => setRoleEditor(r)}>
                      Permissions
                    </button>
                  )}
                  {tab === "channels" && (
                    <button
                      aria-label={`Modifier ${r.name}`}
                      onClick={() => editChannel(r)}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {tab === "categories" && (
                    <button
                      aria-label={`Modifier ${r.name}`}
                      onClick={() =>
                        setForm({
                          title: "Modifier la catégorie",
                          fields: [
                            { key: "name", label: "Nom", value: r.name },
                            {
                              key: "position",
                              label: "Position",
                              type: "number",
                              value: String(r.position),
                            },
                          ],
                          save: async (d) => {
                            await api(`${base}/categories/${r.id}`, "PATCH", {
                              ...d,
                              position: Number(d.position),
                            });
                            done();
                          },
                        })
                      }
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {tab === "accounts" && (
                    <>
                      <button
                        onClick={() =>
                          void action(`accounts/${r.id}/token`, "POST", {
                            revoke: false,
                          })
                        }
                      >
                        <KeyRound size={15} />
                        Renouveler
                      </button>
                      {!r.revoked && (
                        <button
                          onClick={() =>
                            void action(`accounts/${r.id}/token`, "POST", {
                              revoke: true,
                            })
                          }
                        >
                          Révoquer
                        </button>
                      )}
                    </>
                  )}
                  {tab === "webhooks" && !r.revoked && (
                    <button
                      onClick={() => void action(`webhooks/${r.id}`, "DELETE")}
                    >
                      Révoquer
                    </button>
                  )}
                  {tab === "outbound" && can("MANAGE_WEBHOOK") && (
                    <button
                      onClick={() =>
                        setForm({
                          title: "Filtrer les événements sortants",
                          fields: [
                            {
                              key: "event_types",
                              label:
                                "Types séparés par des virgules (vide = tous)",
                              value: (r.event_types || []).join(", "),
                              required: false,
                            },
                          ],
                          save: async (d) => {
                            await api(`${base}/outbound/${r.id}`, "PATCH", {
                              event_types: d.event_types
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean),
                            });
                            done();
                          },
                        })
                      }
                    >
                      Filtres
                    </button>
                  )}
                  {tab === "outbound" && r.enabled && (
                    <button
                      onClick={() => void action(`outbound/${r.id}`, "DELETE")}
                    >
                      Désactiver
                    </button>
                  )}
                  {tab === "flags" && <span className="tag">Désactivé</span>}
                  {tab === "attachments" && (
                    <a
                      className="button"
                      href={`${base}/attachments/${r.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ouvrir
                    </a>
                  )}
                  {tab === "emojis" && (
                    <>
                      <img
                        className="custom-emoji"
                        src={`${base}/attachments/${r.attachment_id}`}
                        alt={r.name}
                      />
                      <button
                        aria-label={`Supprimer ${r.name}`}
                        onClick={() => void action(`emojis/${r.id}`, "DELETE")}
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === "outbound" && deliveries.length > 0 && (
          <>
            <h2 className="section-heading">Livraisons récentes</h2>
            {deliveries.map((d) => (
              <article className="admin-row" key={d.id}>
                <div>
                  <strong>{d.state}</strong>
                  <p>
                    {d.attempts} essai(s) · {d.last_error || "Aucune erreur"}
                  </p>
                </div>
                {d.state !== "sent" && (
                  <div className="row-actions">
                    <button
                      onClick={() =>
                        void action(`deliveries/${d.id}`, "POST", {
                          action: "retry",
                        })
                      }
                    >
                      Réessayer
                    </button>
                    <button
                      onClick={() =>
                        void action(`deliveries/${d.id}`, "POST", {
                          action: "cancel",
                        })
                      }
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </article>
            ))}
          </>
        )}
        {nextCursor && snapshot.key === resourceKey && (
          <button
            onClick={() =>
              void api<Result>(`${base}/${tab}?after=${nextCursor}`)
                .then((r) => {
                  setSnapshot((old) => ({
                    key: resourceKey,
                    data: [...old.data, ...r.data],
                  }));
                  setNextCursor(r.nextCursor || null);
                })
                .catch(fail)
            }
          >
            Charger la suite
          </button>
        )}
      </section>
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {secret && (
        <Modal title="Conservez ce secret" onClose={() => setSecret("")}>
          <div className="secret-box">
            <p>
              Cette valeur est affichée une seule fois. Conservez-la dans un
              gestionnaire de secrets.
            </p>
            <textarea readOnly aria-label="Secret créé" value={secret} />
            <button
              className="primary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(secret)
                  .then(() => setCopied(true))
                  .catch(fail)
              }
            >
              <Copy size={16} />
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </Modal>
      )}
      {roleEditor !== undefined && (
        <Modal
          title={roleEditor ? "Modifier les permissions" : "Créer un rôle"}
          onClose={() => setRoleEditor(undefined)}
        >
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              try {
                await api(
                  `${base}/roles${roleEditor ? `/${roleEditor.id}` : ""}`,
                  roleEditor ? "PATCH" : "POST",
                  {
                    name: String(d.get("name")),
                    permissions: d.getAll("permissions"),
                  },
                );
                setRoleEditor(undefined);
                done();
              } catch (e) {
                fail(e);
              }
            }}
          >
            <label>
              Nom du rôle
              <input name="name" defaultValue={roleEditor?.name} required />
            </label>
            <div className="permission-grid">
              {permissions.map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p}
                    defaultChecked={roleEditor?.permissions.includes(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
            <button className="primary">Enregistrer le rôle</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
