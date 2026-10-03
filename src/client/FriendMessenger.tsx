// src/client/FriendMessenger.tsx
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import { api } from "./api";
import { Avatar } from "./ui";
import type { Row } from "./types";
type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};
type Page = { data: Message[]; nextCursor: string | null };
export function FriendMessenger({
  friend,
  userId,
  close,
  onRead,
}: {
  friend: Row;
  userId: string;
  close: () => void;
  onRead: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [draft, setDraft] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const nonce = useRef({ content: "", id: "" }),
    bottom = useRef<HTMLDivElement>(null),
    active = useRef(true);
  const path = `/api/v1/friends/${friend.id}/messages`;
  useEffect(() => {
    active.current = true;
    let gone = false,
      first = true;
    async function load() {
      if (document.hidden) return;
      try {
        const r = await api<Page>(path);
        if (gone) return;
        setMessages((old) =>
          [...new Map([...old, ...r.data].map((m) => [m.id, m])).values()].sort(
            (a, b) =>
              a.created_at.localeCompare(b.created_at) ||
              a.id.localeCompare(b.id),
          ),
        );
        if (first) {
          setCursor(r.nextCursor);
          first = false;
        }
        const unread = r.data
          .filter((m) => m.recipient_id === userId && !m.read_at)
          .at(-1);
        if (unread) {
          await api(`${path}/read`, "POST", { through: unread.id });
          if (!gone) onRead();
        }
      } catch (e) {
        if (!gone) setError((e as Error).message);
      } finally {
        if (!gone) setLoading(false);
      }
    }
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => {
      gone = true;
      active.current = false;
      clearInterval(timer);
    };
  }, [path, userId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.at(-1)?.id]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    if (nonce.current.content !== content)
      nonce.current = { content, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const r = await api<{ data: Message }>(path, "POST", {
        content,
        client_id: nonce.current.id,
      });
      if (!active.current) return;
      setMessages((old) =>
        old.some((m) => m.id === r.data.id) ? old : [...old, r.data],
      );
      setDraft("");
      nonce.current = { content: "", id: "" };
      onRead();
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <section
      className="friend-messenger"
      aria-label={`Conversation avec ${friend.name}`}
    >
      <header>
        <button aria-label="Retour à mes amis" onClick={close}>
          <ArrowLeft size={18} />
        </button>
        <Avatar name={friend.name} src={friend.avatar} />
        <div>
          <h2>{friend.name}</h2>
          <p>
            {friend.status === "offline"
              ? "Hors ligne · vos messages l’attendront ici"
              : "Conversation privée entre amis"}
          </p>
        </div>
      </header>
      <div
        className="friend-message-list"
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <p role="status">Chargement des messages…</p>
        ) : (
          <>
            {cursor && (
              <button
                onClick={() => {
                  void api<Page>(`${path}?before=${cursor}`)
                    .then((r) => {
                      setMessages((old) => [
                        ...new Map(
                          [...r.data, ...old].map((m) => [m.id, m]),
                        ).values(),
                      ]);
                      setCursor(r.nextCursor);
                    })
                    .catch((e) => setError(e.message));
                }}
              >
                Messages précédents
              </button>
            )}
            {!messages.length && (
              <div className="messenger-empty">
                <MessageSquare size={32} />
                <h3>Commencez la conversation</h3>
                <p>Votre ami peut vous répondre à sa prochaine connexion.</p>
              </div>
            )}
            {messages.map((m) => (
              <article
                key={m.id}
                className={`friend-bubble ${m.sender_id === userId ? "mine" : ""}`}
              >
                <p>{m.content}</p>
                <small>
                  <time dateTime={m.created_at}>
                    {new Date(m.created_at).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </time>
                  {m.sender_id === userId
                    ? ` · ${m.read_at ? "Lu" : "Envoyé"}`
                    : ""}
                </small>
              </article>
            ))}
          </>
        )}
        <div ref={bottom} />
      </div>
      {error && (
        <p role="alert" className="error">
          {error} Votre texte est conservé.
        </p>
      )}
      <form onSubmit={send}>
        <label className="visually-hidden" htmlFor="friend-draft">
          Message à {friend.name}
        </label>
        <textarea
          id="friend-draft"
          placeholder="Écrivez à votre ami…"
          value={draft}
          maxLength={8000}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
        />
        <button className="primary" disabled={busy || !draft.trim()}>
          <Send size={16} />
          {busy ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </section>
  );
}
