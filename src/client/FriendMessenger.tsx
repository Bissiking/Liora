// src/client/FriendMessenger.tsx
import { Markdown, MarkdownToolbar } from "./Markdown";
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
  backLabel = "Retour à mes amis",
}: {
  friend: Row;
  userId: string;
  close: () => void;
  onRead: () => void;
  backLabel?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]),
    [draft, setDraft] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [format, setFormat] = useState(false),
    [preview, setPreview] = useState(false),
    [olderBusy, setOlderBusy] = useState(false),
    [newMessages, setNewMessages] = useState(false);
  const follow = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
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
        setError("");
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
    if (follow.current) bottom.current?.scrollIntoView({ block: "nearest" });
    else setNewMessages(true);
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
      follow.current = true;
      setNewMessages(false);
      setDraft("");
      setPreview(false);
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
        <button
          className="conversation-back icon-button"
          aria-label={backLabel}
          onClick={close}
        >
          <ArrowLeft size={18} />
        </button>
        <Avatar name={friend.name} src={friend.avatar} />
        <div className="conversation-identity">
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
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live="polite"
        aria-busy={loading}
      >
        {loading ? (
          <p role="status">Chargement des messages…</p>
        ) : (
          <>
            {cursor && (
              <button
                disabled={olderBusy}
                onClick={() => {
                  setOlderBusy(true);
                  void api<Page>(`${path}?before=${cursor}`)
                    .then((r) => {
                      setMessages((old) => [
                        ...new Map(
                          [...r.data, ...old].map((m) => [m.id, m]),
                        ).values(),
                      ]);
                      setCursor(r.nextCursor);
                    })
                    .catch((e) => setError(e.message))
                    .finally(() => setOlderBusy(false));
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
            {messages.map((m, index) => (
              <div className="friend-message-group" key={m.id}>
                {(index === 0 ||
                  new Date(messages[index - 1].created_at).toDateString() !==
                    new Date(m.created_at).toDateString()) && (
                  <p className="conversation-date">
                    {new Date(m.created_at).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                )}
                <article
                  key={m.id}
                  className={`friend-bubble ${m.sender_id === userId ? "mine" : ""}`}
                >
                  <Markdown text={m.content} />
                  <small>
                    <time dateTime={m.created_at}>
                      {new Date(m.created_at).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    {m.sender_id === userId
                      ? ` · ${m.read_at ? "Lu" : "Envoyé"}`
                      : ""}
                  </small>
                </article>
              </div>
            ))}
          </>
        )}
        <div ref={bottom} className="conversation-bottom" />
      </div>
      {newMessages && (
        <button
          className="conversation-new"
          onClick={() => {
            follow.current = true;
            bottom.current?.scrollIntoView({ block: "nearest" });
            setNewMessages(false);
          }}
        >
          Aller au dernier message
        </button>
      )}
      {error && (
        <p role="alert" className="error">
          {error} Votre texte est conservé.
        </p>
      )}
      <form onSubmit={send}>
        <div className="conversation-composer-modes">
          <button
            type="button"
            aria-expanded={format}
            onClick={() => {
              setFormat(!format);
              setPreview(false);
            }}
          >
            Mettre en forme
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Écrire" : "Aperçu"}
          </button>
        </div>
        {format && !preview && (
          <MarkdownToolbar
            value={draft}
            onChange={setDraft}
            textareaRef={textarea}
          />
        )}
        {preview && (
          <div className="composer-preview">
            <Markdown text={draft || "Votre aperçu apparaîtra ici."} />
          </div>
        )}
        <label className="visually-hidden" htmlFor="friend-draft">
          Message à {friend.name}
        </label>
        <textarea
          id="friend-draft"
          ref={textarea}
          hidden={preview}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              (e.ctrlKey || e.metaKey) &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={`Écrire à ${friend.name}…`}
          value={draft}
          maxLength={8000}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
        />
        <div className="friend-send-row">
          <small>Ctrl / ⌘ Entrée pour envoyer · Markdown disponible</small>
          <button className="primary" disabled={busy || !draft.trim()}>
            <Send size={16} />
            {busy ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </form>
    </section>
  );
}
