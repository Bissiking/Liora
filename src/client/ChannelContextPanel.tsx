// src/client/ChannelContextPanel.tsx
import { useEffect, useState } from "react";
import { api } from "./api";
import { Avatar, Modal } from "./ui";
import { EntityMenu } from "./ContextMenuProvider";
import { MemberProfile } from "./MemberProfile";
import { messageExcerpt } from "../shared/message-preview";
import type { Row } from "./types";
import type { MenuAction } from "./ContextMenu";
export function ChannelContextPanel({
  base,
  channel,
  presence,
  revision,
  can,
  fail,
  mention,
  openThread,
  openMessage,
  close,
}: {
  base: string;
  channel: Row;
  presence: Row[];
  revision: number;
  can: (p: string) => boolean;
  fail: (e: unknown) => void;
  mention: (id: string) => void;
  openThread: (m: Row) => void;
  openMessage: (id: string) => void;
  close?: () => void;
}) {
  const [data, setData] = useState<{
      members: Row[];
      threads: Row[];
      pins: Row[];
      files: Row[];
    } | null>(null),
    [error, setError] = useState(""),
    [profile, setProfile] = useState<Row | null>(null),
    [roleMember, setRoleMember] = useState<Row | null>(null),
    [roles, setRoles] = useState<Row[]>([]),
    [selectedRole, setSelectedRole] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let gone = false;
    setError("");
    void api<{ data: NonNullable<typeof data> }>(
      `${base}/channels/${channel.id}/context`,
    )
      .then((r) => {
        if (!gone) setData(r.data);
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [base, channel.id, revision]);
  const actions = (m: Row): MenuAction[] => [
    { label: "Voir le profil", run: () => setProfile(m) },
    {
      label: "Copier l’ID",
      run: () => void navigator.clipboard.writeText(m.id).catch(fail),
    },
    ...(can("SEND_MESSAGE")
      ? [
          {
            label: "Envoyer un message privé",
            run: () =>
              void api<{ data: Row }>(`${base}/conversations`, "POST", {
                user_id: m.id,
              })
                .then((r) =>
                  window.dispatchEvent(
                    new CustomEvent("liora:open-channel", {
                      detail: { id: r.data.id },
                    }),
                  ),
                )
                .catch(fail),
          },
        ]
      : []),
    ...(can("MENTION_USERS")
      ? [{ label: "Mentionner", run: () => mention(m.id) }]
      : []),
    { label: "Voir le rôle", run: () => setProfile(m) },
    ...(!m.is_owner && can("MANAGE_MEMBERS")
      ? [
          {
            label: "Gérer le rôle",
            run: () => {
              setRoleMember(m);
              setSelectedRole(m.role_id);
              void api<{ data: Row[] }>(`${base}/roles`)
                .then((r) => setRoles(r.data.filter((r) => !r.is_owner)))
                .catch(fail);
            },
          },
          {
            label: "Retirer du workspace",
            danger: true,
            run: () => {
              if (confirm(`Retirer ${m.name} de cet espace ?`))
                void api(`${base}/members/${m.id}`, "PATCH", {
                  state: "disabled",
                })
                  .then(() =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            members: d.members.filter((x) => x.id !== m.id),
                          }
                        : d,
                    ),
                  )
                  .catch(fail);
            },
          },
          {
            label: "Bannir du workspace",
            danger: true,
            run: () => {
              if (confirm(`Bannir ${m.name} de cet espace ?`))
                void api(`${base}/members/${m.id}`, "PATCH", {
                  state: "banned",
                })
                  .then(() =>
                    setData((d) =>
                      d
                        ? {
                            ...d,
                            members: d.members.filter((x) => x.id !== m.id),
                          }
                        : d,
                    ),
                  )
                  .catch(fail);
            },
          },
        ]
      : []),
  ];
  const body = (
    <div className="channel-context">
      <h2>Contexte du canal</h2>
      {channel.description && (
        <p className="channel-description">{channel.description}</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Chargement…</p>}
      {data && (
        <>
          {[true, false].map((online) => {
            const rows = data.members.filter(
              (m) => presence.some((p) => p.id === m.id) === online,
            );
            return (
              <section key={String(online)}>
                <h3>
                  {online ? "En ligne" : "Hors ligne"} · {rows.length}
                </h3>
                {rows.map((m) => (
                  <EntityMenu
                    key={m.id}
                    label={m.name}
                    actions={actions(m)}
                    className="context-member"
                  >
                    <button
                      className="member-open"
                      onClick={() => setProfile(m)}
                    >
                      <Avatar name={m.name} src={m.avatar} small />
                      <span>
                        <strong>{m.name}</strong>
                        <small>{m.role_name}</small>
                      </span>
                    </button>
                  </EntityMenu>
                ))}
              </section>
            );
          })}
          <section>
            <h3>Fils actifs</h3>
            {data.threads.length ? (
              data.threads.map((m) => (
                <button
                  className="context-item"
                  key={m.id}
                  onClick={() => openThread(m)}
                >
                  <strong>
                    {messageExcerpt(m.content, [
                      ...(m.mentions || []),
                      ...data.members,
                    ]) || "Message sans texte"}
                  </strong>
                  <small>
                    {m.reply_count}{" "}
                    {m.reply_count === 1 ? "réponse" : "réponses"}
                  </small>
                </button>
              ))
            ) : (
              <p className="muted">Aucun fil actif.</p>
            )}
          </section>
          <section>
            <h3>Épingles</h3>
            {data.pins.length ? (
              data.pins.map((m) => (
                <button
                  className="context-item"
                  key={m.id}
                  onClick={() => openMessage(m.id)}
                >
                  {messageExcerpt(
                    m.content,
                    [...(m.mentions || []), ...data.members],
                    100,
                  ) || "Message sans texte"}
                </button>
              ))
            ) : (
              <p className="muted">Aucun message épinglé.</p>
            )}
          </section>
          <section>
            <h3>Fichiers récents</h3>
            {data.files.length ? (
              data.files.map((f) => (
                <EntityMenu
                  label={f.name}
                  actions={[
                    {
                      label: "Télécharger",
                      run: () =>
                        window.open(
                          `${base}/attachments/${f.id}`,
                          "_blank",
                          "noopener",
                        ),
                    },
                    {
                      label: "Copier le lien",
                      run: () =>
                        void navigator.clipboard
                          .writeText(
                            location.origin + `${base}/attachments/${f.id}`,
                          )
                          .catch(fail),
                    },
                  ]}
                  key={f.id}
                >
                  <a
                    className="context-file"
                    href={`${base}/attachments/${f.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {f.name}
                    <small>{Math.ceil(f.size / 1024)} Ko</small>
                  </a>
                </EntityMenu>
              ))
            ) : (
              <p className="muted">Aucun fichier dans ce canal.</p>
            )}
          </section>
        </>
      )}
      {profile && (
        <MemberProfile
          member={profile}
          actions={actions(profile)}
          close={() => setProfile(null)}
        />
      )}{" "}
      {roleMember && (
        <Modal
          title={`Rôle · ${roleMember.name}`}
          onClose={() => setRoleMember(null)}
        >
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              void api(`${base}/members/${roleMember.id}`, "PATCH", {
                role_id: selectedRole,
              })
                .then(() => {
                  setRoleMember(null);
                  setData((d) =>
                    d
                      ? {
                          ...d,
                          members: d.members.map((m) =>
                            m.id === roleMember.id
                              ? {
                                  ...m,
                                  role_id: selectedRole,
                                  role_name:
                                    roles.find((r) => r.id === selectedRole)
                                      ?.name || m.role_name,
                                }
                              : m,
                          ),
                        }
                      : d,
                  );
                })
                .catch(fail)
                .finally(() => setBusy(false));
            }}
          >
            <label>
              Rôle principal
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <button disabled={busy || !selectedRole} className="primary">
              Enregistrer
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
  return close ? (
    <Modal
      title="Membres et contexte"
      onClose={close}
      className="context-drawer"
    >
      {body}
    </Modal>
  ) : (
    <aside className="context-panel useful-context">{body}</aside>
  );
}
