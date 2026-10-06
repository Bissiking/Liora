// src/client/PersonalMessages.tsx
import { useEffect, useState } from "react";
import { Search, MessageSquare, UserPlus } from "lucide-react";
import { api } from "./api";
import { Avatar } from "./ui";
import { FriendMessenger } from "./FriendMessenger";
import { EntityMenu } from "./ContextMenuProvider";
import { messageExcerpt } from "../shared/message-preview";
import type { Row } from "./types";
export function PersonalMessages({
  userId,
  revision,
  openChannel,
  openFriends,
  fail,
}: {
  userId: string;
  revision: number;
  openChannel: (id: string, workspace?: string) => void;
  openFriends: () => void;
  fail: (e: unknown) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [unreadOnly, setUnreadOnly] = useState(false);
  const load = () =>
    void api<{ data: Row[] }>("/api/v1/me/conversations")
      .then((r) => {
        setRows(r.data);
        setError("");
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  useEffect(() => {
    let gone = false;
    void api<{ data: Row[] }>("/api/v1/me/conversations")
      .then((r) => {
        if (!gone) {
          setRows(r.data);
          setLoading(false);
          setError("");
        }
      })
      .catch((e) => {
        if (!gone) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      gone = true;
    };
  }, [revision]);
  const open = (r: Row) =>
    r.kind === "friend" ? setSelected(r) : openChannel(r.id, r.workspace_id);
  const visible = rows.filter(
    (r) =>
      (!unreadOnly || !!r.unread_count) &&
      `${r.name} ${r.workspace_name || ""} ${r.last_message || ""}`
        .toLocaleLowerCase("fr")
        .includes(search.toLocaleLowerCase("fr")),
  );
  return (
    <div
      className={`page personal-messages social-page ${selected ? "has-conversation" : ""}`}
    >
      <header className="page-heading">
        <div>
          <h1>Messages privés</h1>
          <p>Une conversation à poursuivre ? Retrouvez-la ici.</p>
        </div>
        <button onClick={openFriends}>
          <UserPlus size={17} />
          Nouvelle conversation
        </button>
      </header>
      <div
        className={`personal-message-layout ${selected ? "has-conversation" : ""}`}
      >
        <aside
          className="conversation-index"
          aria-label="Conversations privées"
        >
          <div className="conversation-index-tools">
            <label className="social-search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Rechercher une conversation"
                placeholder="Rechercher une conversation"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="segmented">
              <button
                aria-pressed={!unreadOnly}
                onClick={() => setUnreadOnly(false)}
              >
                Toutes
              </button>
              <button
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly(true)}
              >
                Non lues
              </button>
            </div>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
              <button onClick={load}>Réessayer</button>
            </p>
          )}
          <div className="conversation-index-list">
            {loading ? (
              <p role="status">Chargement des conversations…</p>
            ) : visible.length ? (
              visible.map((r) => (
                <EntityMenu
                  key={`${r.kind}:${r.id}`}
                  label={r.name}
                  showButton={false}
                  className={`conversation-entry ${selected?.id === r.id ? "selected" : ""}`}
                  actions={[
                    { label: "Ouvrir", run: () => open(r) },
                    {
                      label: "Copier l’ID",
                      run: () =>
                        void navigator.clipboard.writeText(r.id).catch(fail),
                    },
                  ]}
                >
                  <button
                    className="personal-message-row"
                    aria-current={selected?.id === r.id ? "true" : undefined}
                    onClick={() => open(r)}
                  >
                    <Avatar name={r.name} src={r.avatar} />
                    <span className="conversation-row-copy">
                      <strong>{r.name}</strong>
                      <small>
                        {messageExcerpt(r.last_message || "") ||
                          "Commencer la conversation"}
                      </small>
                      {r.workspace_name && (
                        <small className="conversation-scope">
                          {r.workspace_name}
                        </small>
                      )}
                    </span>
                    {!!r.unread_count && (
                      <b className="unread-count">{r.unread_count}</b>
                    )}
                  </button>
                </EntityMenu>
              ))
            ) : (
              <div className="social-index-empty">
                <h2>
                  {rows.length
                    ? "Aucune conversation trouvée"
                    : "Aucune conversation"}
                </h2>
                <p>
                  {unreadOnly
                    ? "Tous vos messages sont lus."
                    : rows.length
                      ? "Essayez un autre nom."
                      : "Choisissez un ami pour lui écrire."}
                </p>
                {!rows.length && (
                  <button onClick={openFriends}>Voir mes amis</button>
                )}
              </div>
            )}
          </div>
        </aside>
        <section className="conversation-pane">
          {selected ? (
            <FriendMessenger
              key={selected.id}
              friend={selected}
              userId={userId}
              close={() => setSelected(null)}
              backLabel="Retour aux conversations"
              onRead={load}
            />
          ) : (
            <div className="friend-conversation-empty">
              <MessageSquare size={36} />
              <h2>À vous de faire le premier pas</h2>
              <p>
                Choisissez une conversation pour lire vos messages ou écrire à
                un ami.
              </p>
              <button onClick={openFriends}>Voir mes amis</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
