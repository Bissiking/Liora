// src/client/Social.tsx
import { useEffect, useState } from "react";
import { Link, Copy, UserPlus, MessageSquare, Trash2 } from "lucide-react";
import { api } from "./api";
import type { Row, Result } from "./types";
import { Avatar } from "./ui";
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
      <h1>Une invitation à échanger</h1>
      {info && (
        <>
          <p>
            <strong>{info.issuer_name}</strong> vous invite dans ses amis sur{" "}
            <strong>{info.workspace_name}</strong>.
          </p>
          <p>
            {info.can_join
              ? "L’administrateur vous autorise aussi à rejoindre cet espace."
              : "Cette invitation s’adresse aux membres qui ont déjà accès à cet espace."}
          </p>
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
            Accepter l’invitation
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button onClick={() => void done()}>Revenir à mon espace</button>
    </div>
  );
}
export function Friends({
  base,
  workspace,
  can,
  open,
  revision,
  fail,
}: {
  base: string;
  workspace: string;
  can: (p: string) => boolean;
  open: (id: string) => void;
  revision: number;
  fail: (e: unknown) => void;
}) {
  const [friends, setFriends] = useState<Row[]>([]),
    [invites, setInvites] = useState<
      (Row & { accepted_by?: string; expires_at: string })[]
    >([]),
    [online, setOnline] = useState(false),
    [allowJoin, setAllowJoin] = useState(false),
    [link, setLink] = useState(""),
    [copied, setCopied] = useState(false);
  const load = () =>
    void Promise.all([
      api<Result>("/api/v1/friends"),
      api<Result>("/api/v1/invitations"),
    ])
      .then(([f, i]) => {
        setFriends(f.data);
        setInvites(i.data);
      })
      .catch(fail);
  useEffect(load, [revision]);
  useEffect(() => {
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="page friends-page">
      <header className="page-heading">
        <div>
          <h1>Les amis, tout simplement.</h1>
          <p>Une invitation acceptée, puis une conversation à votre rythme.</p>
        </div>
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
          <UserPlus size={17} />
          Créer une invitation
        </button>
      </header>
      {can("MANAGE_MEMBERS") && (
        <label className="check-line">
          <input
            type="checkbox"
            checked={allowJoin}
            onChange={(e) => setAllowJoin(e.target.checked)}
          />
          Autoriser aussi l’entrée d’un nouveau membre dans cet espace
        </label>
      )}
      {link && (
        <section className="invitation-link">
          <Link size={20} />
          <div>
            <strong>Votre lien à usage unique</strong>
            <p>
              Valable 7 jours. La personne devra se connecter avec Kyros et
              accepter.
            </p>
            <input
              aria-label="Lien d’invitation"
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
            <Copy size={16} />
            {copied ? "Copié" : "Copier"}
          </button>
        </section>
      )}
      <div className="section-toolbar">
        <h2>Mes amis · {friends.length}</h2>
        <label className="check-line">
          <input
            type="checkbox"
            checked={online}
            onChange={(e) => setOnline(e.target.checked)}
          />
          En ligne uniquement
        </label>
      </div>
      <div className="friends-list">
        {friends
          .filter((f) => !online || f.status !== "offline")
          .map((f) => (
            <article key={f.id}>
              <Avatar name={f.name} src={f.avatar} />
              <div>
                <strong>{f.name}</strong>
                <p>
                  <span
                    className={`presence-dot ${f.status === "offline" ? "offline" : ""}`}
                  />
                  {{
                    available: "Disponible",
                    busy: "Occupé",
                    away: "Absent",
                    offline: "Hors ligne",
                  }[f.status] || f.status}
                </p>
              </div>
              <button
                onClick={() =>
                  void api<{ data: Row }>(`${base}/conversations`, "POST", {
                    user_id: f.id,
                  })
                    .then((r) => open(r.data.id))
                    .catch(fail)
                }
              >
                <MessageSquare size={16} />
                Écrire
              </button>
              <button
                aria-label={`Retirer ${f.name} des amis`}
                onClick={() => {
                  if (confirm(`Retirer ${f.name} de vos amis ?`))
                    void api(`/api/v1/friends/${f.id}`, "DELETE")
                      .then(load)
                      .catch(fail);
                }}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
      </div>
      {!friends.length && (
        <p className="muted">
          Partagez votre premier lien. Vos amis apparaîtront ici après avoir
          accepté.
        </p>
      )}
      <h2>Invitations envoyées</h2>
      {invites.map((i) => (
        <article className="invitation-row" key={i.id}>
          <span>
            {i.revoked
              ? "Révoquée"
              : i.accepted_by
                ? "Acceptée"
                : new Date(i.expires_at) < new Date()
                  ? "Expirée"
                  : "En attente"}{" "}
            · expire le {new Date(i.expires_at).toLocaleDateString("fr-FR")}
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
  );
}
