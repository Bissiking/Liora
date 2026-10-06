// src/client/Social.tsx
import { useEffect, useState } from "react";
import {
  Link,
  Copy,
  UserPlus,
  MessageSquare,
  Trash2,
  QrCode,
  ChevronDown,
  Users,
  Send,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "./api";
import type { Row, Result } from "./types";
import { FriendMessenger } from "./FriendMessenger";
import { Avatar, Modal } from "./ui";
import { messageExcerpt } from "../shared/message-preview";
export function Invitation({
  token,
  done,
}: {
  token: string;
  done: () => Promise<void>;
}) {
  const [info, setInfo] = useState<{
      issuer_name: string;
      workspace_name: string;
      can_join: boolean;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api<{ data: typeof info }>(`/api/v1/invitations/token/${token}`)
      .then((r) => setInfo(r.data))
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <div className="invitation-page">
      <img src="/brand/icon.svg" alt="Liora" />
      <h1>Demande d'amis</h1>
      {info && (
        <>
          <p>
            <strong>{info.issuer_name}</strong> souhaite vous ajouter à ses
            amis.
          </p>
          {info.can_join && (
            <p>
              Cette invitation vous donnera aussi accès à{" "}
              <strong>{info.workspace_name}</strong>.
            </p>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/v1/invitations/token/${token}/accept`, "POST");
                await done();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Accepter
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button onClick={() => void done()}>Retour</button>
    </div>
  );
}
export function Friends({
  userId,
  workspace,
  revision,
  fail,
}: {
  userId: string;
  workspace: string;
  revision: number;
  fail: (e: unknown) => void;
}) {
  const [conversation, setConversation] = useState<Row | null>(null);
  const [friends, setFriends] = useState<Row[]>([]),
    [invites, setInvites] = useState<
      (Row & { accepted_by?: string; expires_at: string })[]
    >([]),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [allowJoin, setAllowJoin] = useState(false),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false),
    [openInvite, setOpenInvite] = useState(false),
    [openSent, setOpenSent] = useState(false);
  const load = () =>
    void Promise.all([
      api<Result>("/api/v1/friends"),
      api<Result>("/api/v1/invitations"),
    ])
      .then(([f, i]) => {
        setLoadError("");
        setLoading(false);
        setFriends(f.data);
        setConversation((old) =>
          old ? f.data.find((row) => row.id === old.id) || null : null,
        );
        setInvites(i.data);
      })
      .catch((e) => {
        setLoading(false);
        setLoadError(e.message);
      });
  useEffect(load, [revision]);
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);
  const pending = invites.filter(
    (i) => !i.revoked && !i.accepted_by && new Date(i.expires_at) > new Date(),
  );
  return (
    <div
      className={`page friends-page social-page ${conversation ? "has-conversation" : ""}`}
    >
      <header className="page-heading">
        <div>
          <h1>Amis</h1>
          <p>Vos proches, à un message de distance.</p>
        </div>
        <button className="primary" onClick={() => setOpenInvite(true)}>
          <UserPlus size={17} />
          Ajouter un ami
        </button>
      </header>

      <div className="friends-workspace">
        <aside className="friends-index" aria-label="Mes amis">
          <label className="friend-search">
            Rechercher un ami
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou conversation"
            />
          </label>
          <div className="friend-filters segmented">
            {[
              ["all", "Tous"],
              ["unread", "Non lus"],
              ["online", "En ligne"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {loadError && (
            <p className="error" role="alert">
              {loadError}
              <button onClick={load}>Réessayer</button>
            </p>
          )}
          {loading && <p role="status">Chargement des amis…</p>}
          <section className="friends-section">
            <div className="friends-section-header static">
              <Users size={18} />
              <span>Mes amis · {friends.length}</span>
            </div>
            <div className="friends-section-body">
              <div className="friends-list">
                {friends
                  .filter(
                    (f) =>
                      (filter !== "unread" || (f.unread_count || 0) > 0) &&
                      (filter !== "online" || f.status !== "offline") &&
                      (f.name + " " + (f.last_message || ""))
                        .toLocaleLowerCase("fr")
                        .includes(search.toLocaleLowerCase("fr")),
                  )
                  .sort(
                    (a, b) =>
                      Number((b.unread_count || 0) > 0) -
                        Number((a.unread_count || 0) > 0) ||
                      String(
                        (b as Row & { last_message_at?: string })
                          .last_message_at || "",
                      ).localeCompare(
                        String(
                          (a as Row & { last_message_at?: string })
                            .last_message_at || "",
                        ),
                      ) ||
                      a.name.localeCompare(b.name, "fr"),
                  )
                  .map((f) => (
                    <article
                      key={f.id}
                      className={`friend-row ${conversation?.id === f.id ? "selected" : ""}`}
                    >
                      <button
                        className="friend-open"
                        aria-label={`Écrire à ${f.name}`}
                        aria-current={
                          conversation?.id === f.id ? "true" : undefined
                        }
                        onClick={() => setConversation(f)}
                      >
                        <Avatar name={f.name} src={f.avatar} />
                        <div className="friend-info">
                          <strong>
                            {f.name}
                            {!!f.unread_count && (
                              <span className="unread-count">
                                {f.unread_count}
                              </span>
                            )}
                          </strong>
                          {f.last_message && (
                            <small>
                              {messageExcerpt(f.last_message).slice(0, 90)}
                            </small>
                          )}
                          <span className="friend-status">
                            <span
                              className={`presence-dot ${f.status === "offline" ? "offline" : ""}`}
                            />
                            {{
                              available: "Disponible",
                              busy: "Occupé",
                              away: "Absent",
                              offline: "Hors ligne",
                            }[f.status] || f.status}
                          </span>
                        </div>
                      </button>
                      <div className="friend-actions">
                        <button
                          className="icon-button danger"
                          aria-label={`Retirer ${f.name} des amis`}
                          onClick={() => {
                            if (confirm(`Retirer ${f.name} de vos amis ?`))
                              void api(`/api/v1/friends/${f.id}`, "DELETE")
                                .then(load)
                                .catch(fail);
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {!loading &&
                friends.length > 0 &&
                !friends.some(
                  (f) =>
                    (filter !== "unread" || (f.unread_count || 0) > 0) &&
                    (filter !== "online" || f.status !== "offline") &&
                    (f.name + " " + (f.last_message || ""))
                      .toLocaleLowerCase("fr")
                      .includes(search.toLocaleLowerCase("fr")),
                ) && (
                  <p className="muted empty-hint">
                    {filter === "unread"
                      ? "Tout est lu."
                      : "Aucun ami ne correspond à ce filtre."}
                  </p>
                )}
              {!loading && !friends.length && (
                <p className="muted empty-hint">
                  Aucun ami pour le moment. Partagez une invitation pour
                  commencer.
                </p>
              )}
            </div>
          </section>

          <section className="friends-section">
            <button
              className="friends-section-header"
              onClick={() => setOpenSent(!openSent)}
            >
              <Send size={18} />
              <span>Invitations envoyées · {pending.length} en attente</span>
              <ChevronDown
                size={16}
                className={`chevron ${openSent ? "open" : ""}`}
              />
            </button>
            {openSent && (
              <div className="friends-section-body">
                {invites.length ? (
                  <div className="sent-list">
                    {invites.map((i) => (
                      <article className="sent-row" key={i.id}>
                        <span className="sent-status">
                          {i.revoked
                            ? "Révoquée"
                            : i.accepted_by
                              ? "Acceptée"
                              : new Date(i.expires_at) <= new Date()
                                ? "Expirée"
                                : "En attente"}
                        </span>
                        <span className="sent-date">
                          {new Date(i.expires_at).toLocaleDateString("fr-FR")}
                        </span>
                        {!i.revoked && !i.accepted_by && (
                          <button
                            onClick={() =>
                              void api(`/api/v1/invitations/${i.id}`, "DELETE")
                                .then(load)
                                .catch(fail)
                            }
                          >
                            Révoquer
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted empty-hint">Aucune invitation envoyée.</p>
                )}
              </div>
            )}
          </section>
        </aside>
        <div className="friends-conversation">
          {conversation ? (
            <FriendMessenger
              key={conversation.id}
              friend={conversation}
              userId={userId}
              close={() => setConversation(null)}
              onRead={load}
            />
          ) : (
            <div className="friend-conversation-empty">
              <MessageSquare size={32} />
              <h2>Prenez des nouvelles</h2>
              <p>
                Choisissez un ami pour lui écrire, ou partagez une invitation
                pour retrouver vos proches.
              </p>
            </div>
          )}
        </div>
      </div>
      {openInvite && (
        <Modal
          title="Ajouter un ami"
          className="friend-invite-dialog"
          onClose={() => setOpenInvite(false)}
        >
          {" "}
          {!workspace && (
            <p className="muted">
              Pour inviter un nouvel ami, créez ou rejoignez un espace. Vos
              conversations existantes restent accessibles ici.
            </p>
          )}
          {workspace && (
            <div className="friends-section-body">
              <label className="check-line">
                <input
                  type="checkbox"
                  checked={allowJoin}
                  onChange={(e) => setAllowJoin(e.target.checked)}
                />
                Autoriser aussi l'accès à mon espace
              </label>
              <button
                className="primary"
                onClick={() =>
                  void api<{ url: string }>("/api/v1/invitations", "POST", {
                    workspace_id: workspace,
                    allow_join: allowJoin,
                  })
                    .then((r) => {
                      setLink(r.url);
                      load();
                    })
                    .catch(fail)
                }
              >
                <UserPlus size={16} />
                Générer un lien
              </button>
              {link && (
                <div className="invitation-card">
                  <div className="invitation-card-link">
                    <Link size={16} />
                    <div>
                      <strong>Lien à usage unique</strong>
                      <p>Valable 7 jours</p>
                      <input
                        aria-label="Lien d'invitation"
                        value={link}
                        readOnly
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <button
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(link)
                          .then(() => setCopied(true))
                          .catch(fail)
                      }
                    >
                      <Copy size={14} />
                      {copied ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <div className="invitation-card-qr">
                    <QRCodeSVG
                      value={link}
                      size={100}
                      bgColor="var(--surface)"
                      fgColor="var(--text)"
                    />
                    <span>
                      <QrCode size={11} /> Scanner
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
