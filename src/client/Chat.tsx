// src/client/Chat.tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Hash,
  Pin,
  MessageSquare,
  Lock,
  Send,
  Smile,
  Reply,
  Pencil,
  Trash2,
  Paperclip,
  ArrowUpRight,
  Activity,
  Bell,
  Check,
  X,
  AtSign,
  Copy,
  FolderOpen,
  Terminal,
  CalendarDays,
} from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result, User } from "./types";
import { ConnectedAccounts } from "./Integrations";
import { Avatar, Time, FormDialog, Modal } from "./ui";
import { Thread, ChannelAccess } from "./Collaboration";
import {
  MessageContent,
  displayMentions,
  encodeMentions,
  replyPreview,
} from "./MessageContent";
import { EmojiPicker } from "./EmojiPicker";
import {
  detectDateTimes,
  formatDateTimeForDisplay,
  formatDateOnlyForDisplay,
} from "../shared/date-detection.client";
import { instantFromLocal, localDateTime } from "../shared/schedule";
export function Chat({
  base,
  channel,
  user,
  can,
  revision,
  refresh,
  fail,
  presence,
  targetMessage,
  clearTarget,
}: {
  base: string;
  channel: Row;
  user: User;
  can: (p: string) => boolean;
  revision: number;
  refresh: () => void;
  fail: (e: unknown) => void;
  presence: Row[];
  targetMessage: string;
  clearTarget: () => void;
}) {
  const [focused, setFocused] = useState<Row | null>(null);
  const [pickEmoji, setPickEmoji] = useState(false),
    [followBusy, setFollowBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [thread, setThread] = useState<Row | null>(null),
    [pinned, setPinned] = useState(false),
    [access, setAccess] = useState(false);
  const [messages, setMessages] = useState<Row[]>([]),
    [draft, setDraft] = useState(""),
    [detectedDates, setDetectedDates] = useState<
      Array<{
        originalText: string;
        start: Date;
        end?: Date;
        allDay?: boolean;
        timezone?: string;
      }>
    >([]),
    [eventFromDate, setEventFromDate] = useState<{
      start: Date;
      end?: Date;
      allDay?: boolean;
      timezone?: string;
      originalText: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [reply, setReply] = useState<Row | null>(null),
    [edit, setEdit] = useState<Row | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [emojiFor, setEmojiFor] = useState(""),
    [emojis, setEmojis] = useState<Row[]>([]),
    [follow, setFollow] = useState(false),
    [members, setMembers] = useState<Row[]>([]),
    [mentionOpen, setMentionOpen] = useState(false),
    [attachments, setAttachments] = useState<Row[]>([]);
  const detectDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (detectDebounce.current) clearTimeout(detectDebounce.current);
    },
    [channel.id],
  );
  const end = useRef<HTMLDivElement>(null),
    scroll = useRef<HTMLDivElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null),
    file = useRef<HTMLInputElement>(null),
    atBottom = useRef(true);
  useEffect(() => {
    setDraft("");
    setReply(null);
    setThread(null);
    setPinned(false);
    setMessages([]);
    setAttachments([]);
    setFollow(false);
    void api<{ data: { following: boolean } }>(
      `${base}/channels/${channel.id}/follow`,
    )
      .then((r) => setFollow(r.data.following))
      .catch(fail);
    atBottom.current = true;
  }, [channel.id]);
  useEffect(() => {
    let gone = false;
    api<Result>(
      `${base}/channels/${channel.id}/messages${pinned ? "?pinned=true" : ""}`,
    )
      .then((r) => {
        if (gone) return;
        setMessages(r.data);
        setCursor(r.nextCursor || null);
        if (atBottom.current)
          setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 30);
      })
      .catch(fail);
    return () => {
      gone = true;
    };
  }, [base, channel.id, revision, pinned]);
  useEffect(() => {
    void Promise.all([
      api<Result>(`${base}/emojis`),
      collection(`${base}/members`),
    ])
      .then(([e, m]) => {
        setEmojis(e.data);
        setMembers(m.data);
      })
      .catch(fail);
  }, [base]);
  const [dropitOpen, setDropitOpen] = useState(false);
  const [commandResult, setCommandResult] = useState<{
    title: string;
    lines: string[];
  } | null>(null);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    try {
      if (draft.trim().startsWith("/")) {
        setCommandResult(
          await api(`${base}/commands`, "POST", {
            channel_id: channel.id,
            command: draft.trim(),
          }),
        );
        setDraft("");
        setDetectedDates([]);
        if (detectDebounce.current) clearTimeout(detectDebounce.current);
        return;
      }
      await api(`${base}/channels/${channel.id}/messages`, "POST", {
        content: encodeMentions(draft.trim(), members),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        reply_to: reply?.id || null,
        attachment_ids: attachments.map((a) => a.id),
      }).then((res: any) => {
        if (res.detectedDates?.length) {
          setNotice(
            `${res.detectedDates.length} date(s) détectée(s) dans votre message.`,
          );
        }
      });
      setDraft("");
      setReply(null);
      setAttachments([]);
      atBottom.current = true;
      refresh();
      textarea.current?.focus();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File) {
    try {
      if (f.size > 1000000)
        throw Error("La pièce jointe doit faire moins de 1 Mo.");
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1]);
        r.onerror = reject;
        r.readAsDataURL(f);
      });
      const r = await api<{ data: Row }>(`${base}/attachments`, "POST", {
        name: f.name,
        data,
        channel_id: channel.id,
      });
      setAttachments((old) => [...old, r.data]);
      setDraft(
        (old) =>
          `${old}${old ? "\n" : ""}${location.origin}${base}/attachments/${r.data.id}`,
      );
    } catch (e) {
      fail(e);
    }
  }
  useEffect(() => {
    if (!targetMessage) return;
    let gone = false;
    void api<{ data: Row }>(`${base}/messages/${targetMessage}`)
      .then(async (r) => {
        if (gone) return;
        setPinned(false);
        if (r.data.thread_id) {
          const root = await api<{ data: Row }>(
            `${base}/messages/${r.data.thread_id}`,
          );
          if (!gone) setThread(root.data);
        } else {
          setFocused(r.data);
          setMessages((old) =>
            old.some((m) => m.id === r.data.id) ? old : [r.data, ...old],
          );
          setTimeout(
            () =>
              document
                .getElementById(`message-${r.data.id}`)
                ?.scrollIntoView({ block: "center", behavior: "smooth" }),
            60,
          );
        }
        clearTarget();
      })
      .catch(fail);
    return () => {
      gone = true;
    };
  }, [targetMessage]);
  return (
    <div className="chat-layout">
      {commandResult && (
        <Modal
          title={commandResult.title}
          onClose={() => setCommandResult(null)}
        >
          <div className="integration-dialog-body">
            <p className="muted">Résultat visible uniquement par vous.</p>
            {commandResult.lines.length ? (
              commandResult.lines.map((line, i) => <p key={i}>{line}</p>)
            ) : (
              <p>Aucun résultat.</p>
            )}
          </div>
        </Modal>
      )}
      {dropitOpen && (
        <Modal title="Mes fichiers DropIt" onClose={() => setDropitOpen(false)}>
          <div className="integration-dialog-body">
            <ConnectedAccounts
              base={base}
              fail={fail}
              pick={(url) => {
                setDraft((old) => old + (old ? "\n" : "") + url);
                setDropitOpen(false);
              }}
            />
          </div>
        </Modal>
      )}
      <section className="chat-main">
        <header className="channel-heading">
          <div className="channel-heading-icon">
            {channel.is_private ? <Lock size={23} /> : <Hash size={23} />}
          </div>
          <div>
            <h1>{channel.name}</h1>
            <p>
              {channel.is_dm
                ? "Conversation privée entre deux membres."
                : channel.is_private
                  ? "Salon privé · accès réservé aux membres autorisés."
                  : channel.description ||
                    "Une conversation ouverte à l’équipe."}
            </p>
          </div>
          {channel.is_private && !channel.is_dm && can("MANAGE_CHANNEL") && (
            <button
              className="icon-button"
              aria-label="Gérer les accès du salon"
              onClick={() => setAccess(true)}
            >
              <Lock size={18} />
            </button>
          )}
          <button
            className={`icon-button ${pinned ? "selected" : ""}`}
            aria-label={pinned ? "Tous les messages" : "Messages épinglés"}
            onClick={() => setPinned(!pinned)}
          >
            <Pin size={18} />
            <span className="header-action-label">
              {pinned ? "Tous les messages" : "Épingles"}
            </span>
          </button>
          <button
            className={`icon-button ${follow ? "selected" : ""}`}
            aria-pressed={follow}
            disabled={followBusy}
            title={follow ? "Ne plus suivre le salon" : "Suivre le salon"}
            aria-label={follow ? "Ne plus suivre le salon" : "Suivre le salon"}
            onClick={() => (
              setFollowBusy(true),
              void api(`${base}/channels/${channel.id}/follow`, "PUT", {
                following: !follow,
                muted: false,
              })
                .then(() => {
                  setFollow(!follow);
                  setNotice(
                    !follow
                      ? "Salon suivi : les nouveaux messages apparaîtront dans votre boîte de réception."
                      : "Le suivi de ce salon est désactivé.",
                  );
                })
                .catch(fail)
                .finally(() => setFollowBusy(false))
            )}
          >
            <Bell size={18} />
            <span className="header-action-label">
              {follow ? "Suivi" : "Notifications"}
            </span>
          </button>
        </header>
        {notice && (
          <div className="chat-notice" role="status">
            {notice}
            <button
              onClick={() => setNotice("")}
              aria-label="Fermer le message"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div
          className="message-scroll"
          ref={scroll}
          onScroll={() => {
            const el = scroll.current;
            atBottom.current =
              !!el && el.scrollHeight - el.scrollTop - el.clientHeight < 140;
          }}
        >
          {pinned && !messages.length && (
            <div className="pinned-empty">
              <Pin size={23} />
              <h2>Aucun message épinglé</h2>
              <p>
                Épinglez un message avec son bouton d’épingle pour le retrouver
                ici.
              </p>
            </div>
          )}
          {cursor ? (
            <button
              className="load-older"
              onClick={() =>
                void api<Result>(
                  `${base}/channels/${channel.id}/messages?before=${cursor}${pinned ? "&pinned=true" : ""}`,
                )
                  .then((r) => {
                    setMessages((old) => [...r.data, ...old]);
                    setCursor(r.nextCursor || null);
                  })
                  .catch(fail)
              }
            >
              Charger les messages précédents
            </button>
          ) : (
            <div className="conversation-intro">
              <span className="intro-symbol">
                <Hash size={31} />
              </span>
              <h2>Tout commence par une conversation.</h2>
              <p>
                Bienvenue dans <strong>#{channel.name}</strong>. Partagez une
                idée, posez une question,
                <br className="desktop-only" /> ou faites simplement avancer les
                choses.
              </p>
              <span className="intro-rule" />
            </div>
          )}
          <div className="day-divider">
            <span>
              {messages.length
                ? new Date(messages[0].created_at).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })
                : "Aujourd’hui"}
            </span>
          </div>
          {(focused && !pinned && !messages.some((m) => m.id === focused.id)
            ? [focused, ...messages]
            : messages
          ).map((m) => (
            <article className="message" id={`message-${m.id}`} key={m.id}>
              <Avatar name={m.author_name || "Liora"} src={m.author_avatar} />
              <div className="message-body">
                <div className="message-meta">
                  <strong>{m.author_name}</strong>
                  {m.author_kind !== "human" && (
                    <span className="bot-tag">
                      {m.author_kind === "bot" ? "BOT" : "SERVICE"}
                    </span>
                  )}
                  {user.preferences.timestamps !== false && (
                    <Time value={m.created_at} />
                  )}{" "}
                  {m.edited_at && <small>modifié</small>}
                </div>
                {m.reply_to && (
                  <div className="reply-preview">
                    <Reply size={13} />{" "}
                    {replyPreview(
                      messages.find((p) => p.id === m.reply_to),
                      members,
                    )}
                  </div>
                )}
                {m.pinned_at && (
                  <small className="pin-label">
                    <Pin size={12} /> Message épinglé
                  </small>
                )}
                <MessageContent
                  text={m.content}
                  base={base}
                  channel={channel.id}
                  members={[...members, ...(m.mentions || [])]}
                  previews={user.preferences.linkPreviews !== false}
                  detectedDates={m.detectedDates || []}
                  onDateClick={(d) =>
                    can("CREATE_CALENDAR_EVENT") &&
                    setEventFromDate({
                      ...d,
                      start:
                        typeof d.start === "string"
                          ? new Date(d.start)
                          : d.start,
                      end:
                        d.end && typeof d.end === "string"
                          ? new Date(d.end)
                          : d.end,
                    })
                  }
                />
                <button className="thread-link" onClick={() => setThread(m)}>
                  <MessageSquare size={14} />
                  {m.reply_count
                    ? `${m.reply_count} réponse${m.reply_count > 1 ? "s" : ""}`
                    : "Ouvrir le fil"}
                </button>
                <div className="reactions">
                  {[...new Set(m.reactions.map((r) => r.emoji))].map((e) => (
                    <button
                      key={e}
                      className={
                        m.reactions.some(
                          (r) => r.emoji === e && r.actor_id === user.id,
                        )
                          ? "selected"
                          : ""
                      }
                      onClick={() =>
                        void api(`${base}/messages/${m.id}/reactions`, "POST", {
                          emoji: e,
                        })
                          .then(refresh)
                          .catch(fail)
                      }
                    >
                      {e.startsWith(":") ? (
                        <img
                          className="custom-emoji"
                          src={`${base}/attachments/${emojis.find((x) => `:${x.name}:` === e)?.attachment_id}`}
                          alt={e}
                        />
                      ) : (
                        e
                      )}
                      <span>
                        {m.reactions.filter((r) => r.emoji === e).length}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="message-actions">
                <button
                  className="icon-button"
                  aria-label="Copier l’identifiant du message"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(m.id)
                      .then(() =>
                        setNotice(
                          "Identifiant copié. Vous pouvez l’utiliser dans un bloc Message.",
                        ),
                      )
                      .catch(fail)
                  }
                >
                  <Copy size={14} />
                </button>
                {can("MANAGE_MESSAGES") && (
                  <button
                    className="icon-button"
                    aria-label={m.pinned_at ? "Désépingler" : "Épingler"}
                    onClick={() =>
                      void api(`${base}/messages/${m.id}/pin`, "PUT", {
                        pinned: !m.pinned_at,
                      })
                        .then(refresh)
                        .catch(fail)
                    }
                  >
                    <Pin size={15} />
                  </button>
                )}
                {can("ADD_REACTION") && (
                  <button
                    className="icon-button"
                    aria-label="Ajouter une réaction"
                    onClick={() => setEmojiFor(emojiFor === m.id ? "" : m.id)}
                  >
                    <Smile size={16} />
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label="Répondre"
                  onClick={() => {
                    setReply(m);
                    textarea.current?.focus();
                  }}
                >
                  <Reply size={16} />
                </button>
                {m.user_id === user.id && can("EDIT_OWN_MESSAGE") && (
                  <button
                    className="icon-button"
                    aria-label="Modifier le message"
                    onClick={() => setEdit(m)}
                  >
                    <Pencil size={15} />
                  </button>
                )}
                {(m.user_id === user.id
                  ? can("DELETE_OWN_MESSAGE")
                  : can("MANAGE_MESSAGES")) && (
                  <button
                    className="icon-button"
                    aria-label="Supprimer le message"
                    onClick={() =>
                      void api(`${base}/messages/${m.id}`, "DELETE")
                        .then(refresh)
                        .catch(fail)
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {emojiFor === m.id && (
                <EmojiPicker
                  custom={emojis.map((e) => `:${e.name}:`)}
                  close={() => setEmojiFor("")}
                  select={(emoji) =>
                    void api(`${base}/messages/${m.id}/reactions`, "POST", {
                      emoji,
                    })
                      .then(refresh)
                      .catch(fail)
                  }
                />
              )}
            </article>
          ))}
          <div ref={end} />
        </div>
        {can("SEND_MESSAGE") &&
        !channel.archived &&
        (channel.type !== "announcement" || can("MANAGE_CHANNEL")) ? (
          <div className="composer-wrap">
            {reply && (
              <div className="reply-banner">
                <Reply size={15} />
                <span>En réponse à {reply.author_name}</span>
                <button
                  className="icon-button"
                  aria-label="Annuler la réponse"
                  onClick={() => setReply(null)}
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <form className="composer" onSubmit={send}>
              <textarea
                ref={textarea}
                aria-label={`Message dans ${channel.name}`}
                placeholder={`Écrire dans #${channel.name}…`}
                value={draft}
                maxLength={8000}
                rows={2}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft(value);
                  if (detectDebounce.current)
                    clearTimeout(detectDebounce.current);
                  detectDebounce.current = setTimeout(() => {
                    const dates = detectDateTimes(value);
                    setDetectedDates(dates);
                  }, 300);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    user.preferences.enterToSend !== false &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="composer-toolbar">
                {detectedDates.length > 0 && (
                  <div className="date-pills" aria-label="Dates détectées">
                    {detectedDates.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        className="date-pill"
                        disabled={!can("CREATE_CALENDAR_EVENT")}
                        onClick={() =>
                          setEventFromDate({
                            ...d,
                            start:
                              typeof d.start === "string"
                                ? new Date(d.start)
                                : d.start,
                            end:
                              d.end && typeof d.end === "string"
                                ? new Date(d.end)
                                : d.end,
                          })
                        }
                        aria-label={`Créer un événement pour ${d.allDay ? formatDateOnlyForDisplay(d.start, d.timezone) : formatDateTimeForDisplay(d.start, d.timezone)}`}
                      >
                        <CalendarDays size={15} aria-hidden="true" />
                        <span className="date-pill-text">
                          {d.allDay
                            ? formatDateOnlyForDisplay(d.start, d.timezone)
                            : formatDateTimeForDisplay(d.start, d.timezone)}
                          {d.end &&
                            ` – ${new Date(d.end).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: d.timezone,
                            })}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  ref={file}
                  className="visually-hidden"
                  aria-label="Pièce jointe"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Joindre un fichier"
                  onClick={() => file.current?.click()}
                >
                  <Paperclip size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Ajouter un emoji"
                  onClick={() => setPickEmoji(true)}
                >
                  <Smile size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Mentionner un membre"
                  onClick={() => setMentionOpen(!mentionOpen)}
                >
                  <AtSign size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fichiers DropIt"
                  onClick={() => setDropitOpen(true)}
                >
                  <FolderOpen size={18} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Commandes disponibles"
                  onClick={() =>
                    void api<{ title: string; lines: string[] }>(
                      `${base}/commands`,
                      "POST",
                      { channel_id: channel.id, command: "/aide" },
                    )
                      .then(setCommandResult)
                      .catch(fail)
                  }
                >
                  <Terminal size={18} />
                </button>
                <span className="composer-hint">Une idée à partager ?</span>
                <button
                  className="send-button"
                  aria-label="Envoyer le message"
                  disabled={busy || !draft.trim()}
                >
                  <Send size={17} />
                </button>
              </div>
              {mentionOpen && (
                <div className="mention-menu">
                  {members.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        setDraft((d) => `${d}@${m.name} `);
                        setMentionOpen(false);
                        textarea.current?.focus();
                      }}
                    >
                      @{m.name}
                    </button>
                  ))}
                </div>
              )}
            </form>
            <div className="composer-footnote">
              <span>
                <kbd>Entrée</kbd> pour envoyer · <kbd>⇧ Entrée</kbd> pour une
                nouvelle ligne
              </span>
              <span>{draft.length > 7000 ? `${draft.length}/8000` : ""}</span>
            </div>
            {attachments.length > 0 && (
              <small className="muted">
                {attachments.length} fichier(s) importé(s), lien ajouté au
                brouillon.
              </small>
            )}
          </div>
        ) : (
          <p className="padded muted">Ce salon est en lecture seule.</p>
        )}
      </section>
      <aside className="context-panel">
        <h2>{channel.is_dm ? "Conversation privée" : "Dans ce salon"}</h2>
        <div className="context-description">
          <Hash size={20} />
          <strong>Un fil commun</strong>
          <p>
            {channel.is_dm
              ? "Seuls les deux participants peuvent lire ces messages."
              : channel.is_private
                ? "Les accès à ce salon sont définis par les gestionnaires de l’espace."
                : channel.description ||
                  "Les échanges qui font avancer notre équipe."}
          </p>
        </div>
        <section>
          <h3>
            <span className="tiny-dot" />
            En ligne dans l’espace <span>{presence.length}</span>
          </h3>
          {presence.map((p) => (
            <div className="presence-person" key={p.id}>
              <Avatar name={p.name} small />
              <span>
                {p.name}
                <small>
                  {p.status === "busy"
                    ? "Occupé"
                    : p.status === "away"
                      ? "Absent"
                      : "Disponible"}
                </small>
              </span>
              <i />
            </div>
          ))}
        </section>
        <div className="context-bottom">
          <Activity size={20} />
          <p>
            Chaque signal a sa place.
            <br />
            <span>Gardons les échanges utiles.</span>
          </p>
        </div>
      </aside>
      {pickEmoji && (
        <EmojiPicker
          custom={emojis.map((e) => `:${e.name}:`)}
          select={(emoji) => setDraft((d) => d + emoji)}
          close={() => setPickEmoji(false)}
        />
      )}
      {thread && (
        <Thread
          base={base}
          channel={channel}
          root={thread}
          user={user}
          members={members}
          revision={revision}
          can={can}
          refresh={refresh}
          close={() => setThread(null)}
        />
      )}
      {access && (
        <ChannelAccess
          base={base}
          channel={channel}
          refresh={refresh}
          close={() => setAccess(false)}
        />
      )}
      {edit && (
        <FormDialog
          title="Modifier le message"
          fields={[
            {
              key: "content",
              label: "Message",
              type: "textarea",
              value: displayMentions(edit.content, members),
            },
          ]}
          onSave={async (d) => {
            await api(`${base}/messages/${edit.id}`, "PATCH", {
              ...d,
              content: encodeMentions(d.content, members),
            });
            refresh();
          }}
          onClose={() => setEdit(null)}
        />
      )}
      {eventFromDate && (
        <FormDialog
          title="Créer un événement"
          fields={[
            { key: "title", label: "Titre", required: true },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              required: false,
            },
            {
              key: "start_at",
              label: "Début",
              type: "datetime-local",
              value: localDateTime(
                eventFromDate.start,
                eventFromDate.timezone ||
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
              ),
            },
            {
              key: "end_at",
              label: "Fin (facultatif)",
              type: "datetime-local",
              required: false,
              value: eventFromDate.end
                ? localDateTime(
                    eventFromDate.end,
                    eventFromDate.timezone ||
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                  )
                : "",
            },
            {
              key: "timezone",
              label: "Fuseau",
              value:
                eventFromDate.timezone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            {
              key: "all_day",
              label: "Toute la journée",
              value: eventFromDate.allDay ? "true" : "false",
              options: [
                { value: "false", label: "Non" },
                { value: "true", label: "Oui" },
              ],
            },
            {
              key: "recurrence",
              label: "Répétition",
              value: "none",
              options: [
                { value: "none", label: "Aucune" },
                { value: "daily", label: "Quotidien" },
                { value: "weekly", label: "Hebdomadaire" },
                { value: "monthly", label: "Mensuel" },
                { value: "yearly", label: "Annuel" },
              ],
            },
            {
              key: "reminder_minutes",
              label: "Rappel (auteur uniquement)",
              required: false,
              options: [
                { value: "", label: "Aucun" },
                { value: "0", label: "À l'heure" },
                { value: "15", label: "15 min avant" },
                { value: "60", label: "1h avant" },
                { value: "1440", label: "La veille" },
              ],
            },
          ]}
          onSave={async (d) => {
            const allDay = d.all_day === "true";
            const from = allDay
              ? `${d.start_at.slice(0, 10)}T00:00`
              : d.start_at;
            let to = d.end_at
              ? allDay
                ? `${d.end_at.slice(0, 10)}T00:00`
                : d.end_at
              : "";
            if (allDay && !to) {
              const next = new Date(`${d.start_at.slice(0, 10)}T12:00`);
              next.setDate(next.getDate() + 1);
              to = next.toISOString().slice(0, 16);
            }
            await api(`${base}/calendar`, "POST", {
              title: d.title,
              description: d.description,
              start_at: instantFromLocal(from, d.timezone),
              end_at: to ? instantFromLocal(to, d.timezone) : null,
              timezone: d.timezone,
              all_day: allDay,
              recurrence: d.recurrence,
              reminder_minutes:
                d.reminder_minutes === "" ? null : Number(d.reminder_minutes),
            });
            setEventFromDate(null);
            setNotice("Événement créé dans le calendrier.");
          }}
          onClose={() => setEventFromDate(null)}
        />
      )}
    </div>
  );
}
