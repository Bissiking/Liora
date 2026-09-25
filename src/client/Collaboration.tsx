// src/client/Collaboration.tsx
import { useEffect, useState, type FormEvent } from "react";
import { api, collection } from "./api";
import type { Row, Result, User } from "./types";
import { Modal, Time, FormDialog } from "./ui";
import {
  MessageContent,
  displayMentions,
  encodeMentions,
} from "./MessageContent";
export function Thread({
  base,
  channel,
  root,
  revision,
  can,
  refresh,
  close,
  user,
  members,
}: {
  user: User;
  members: Row[];
  base: string;
  channel: Row;
  root: Row;
  revision: number;
  can: (p: string) => boolean;
  refresh: () => void;
  close: () => void;
}) {
  const [edit, setEdit] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[]>([]),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cursor, setCursor] = useState<string | null>(null);
  useEffect(() => {
    let gone = false;
    void api<Result>(
      `${base}/channels/${channel.id}/messages?thread=${root.id}`,
    )
      .then((r) => {
        if (!gone) {
          setRows(r.data);
          setCursor(r.nextCursor || null);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      gone = true;
    };
  }, [base, channel.id, root.id, revision]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`${base}/channels/${channel.id}/messages`, "POST", {
        content: encodeMentions(draft, members),
        thread_id: root.id,
      });
      setDraft("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Fil de discussion" onClose={close}>
      {edit && (
        <FormDialog
          title="Modifier la réponse"
          fields={[
            {
              key: "content",
              label: "Réponse",
              type: "textarea",
              value: displayMentions(edit.content, members),
            },
          ]}
          onSave={async (d) => {
            await api(`${base}/messages/${edit.id}`, "PATCH", {
              content: encodeMentions(d.content, members),
            });
            refresh();
          }}
          onClose={() => setEdit(null)}
        />
      )}
      <div className="collaboration-panel">
        <blockquote>
          <strong>{root.author_name}</strong>
          <MessageContent
            text={root.content}
            base={base}
            channel={channel.id}
            members={members}
          />
        </blockquote>
        {cursor && (
          <button
            onClick={() =>
              void api<Result>(
                `${base}/channels/${channel.id}/messages?thread=${root.id}&before=${cursor}`,
              )
                .then((r) => {
                  setRows((old) => [...r.data, ...old]);
                  setCursor(r.nextCursor || null);
                })
                .catch((e) => setError(e.message))
            }
          >
            Réponses précédentes
          </button>
        )}
        <div className="thread-replies">
          {rows.length ? (
            rows.map((r) => (
              <article key={r.id}>
                <strong>{r.author_name}</strong> <Time value={r.created_at} />
                <MessageContent
                  text={r.content}
                  base={base}
                  channel={channel.id}
                  members={[...members, ...(r.mentions || [])]}
                />
                <div className="thread-actions">
                  {r.user_id === user.id && can("EDIT_OWN_MESSAGE") && (
                    <button onClick={() => setEdit(r)}>
                      Modifier la réponse
                    </button>
                  )}
                  {(r.user_id === user.id
                    ? can("DELETE_OWN_MESSAGE")
                    : can("MANAGE_MESSAGES")) && (
                    <button
                      onClick={() => {
                        if (confirm("Supprimer cette réponse ?"))
                          void api(`${base}/messages/${r.id}`, "DELETE")
                            .then(refresh)
                            .catch((e) => setError(e.message));
                      }}
                    >
                      Supprimer la réponse
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className="muted">
              La discussion continue ici. Les réponses restent regroupées dans
              ce fil.
            </p>
          )}
        </div>
        {can("CREATE_THREAD") && can("SEND_MESSAGE") && (
          <form className="form" onSubmit={submit}>
            <label>
              Répondre dans le fil
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                required
                maxLength={8000}
              />
            </label>
            <button className="primary" disabled={busy || !draft.trim()}>
              Envoyer la réponse
            </button>
          </form>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
export function SearchMessages({
  base,
  close,
  open,
}: {
  base: string;
  close: () => void;
  open: (id: string, message: string) => void;
}) {
  const [q, setQ] = useState(""),
    [rows, setRows] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [searched, setSearched] = useState(""),
    [channels, setChannels] = useState<Row[]>([]),
    [channel, setChannel] = useState(""),
    [author, setAuthor] = useState(""),
    [from, setFrom] = useState(""),
    [until, setUntil] = useState(""),
    [submitted, setSubmitted] = useState("");
  useEffect(() => {
    let gone = false;
    void collection(`${base}/channels`)
      .then((r) => {
        if (!gone) setChannels(r.data);
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [base]);
  async function search(more = false) {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ q });
      if (channel) params.set("channel", channel);
      if (author.trim()) params.set("author", author.trim());
      if (from) params.set("from", new Date(`${from}T00:00:00`).toISOString());
      if (until) {
        const end = new Date(`${until}T00:00:00`);
        end.setDate(end.getDate() + 1);
        params.set("until", end.toISOString());
      }
      const filters = more ? submitted : params.toString();
      const r = await api<Result>(
        `${base}/search?${filters}${more && cursor ? `&before=${cursor}` : ""}`,
      );
      if (!more) setSubmitted(filters);
      setRows((old) => (more ? [...old, ...r.data] : r.data));
      setCursor(r.nextCursor || null);
      if (!more) setSearched(q);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Rechercher des messages" onClose={close}>
      <div className="collaboration-panel">
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <label>
            Mots à rechercher
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              minLength={2}
              maxLength={200}
              required
              placeholder="Un sujet, une décision…"
            />
          </label>
          <div className="search-filters">
            <label>
              Salon
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="">Tous les salons accessibles</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Auteur
              <input
                value={author}
                maxLength={100}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Nom affiché"
              />
            </label>
            <label>
              Du
              <input
                type="date"
                value={from}
                max={until || undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Au, inclus
              <input
                type="date"
                value={until}
                min={from || undefined}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
          </div>
          <button className="primary" disabled={busy}>
            Rechercher
          </button>
        </form>
        <p className="muted">
          Utilisez des guillemets pour une expression exacte et un signe moins
          pour exclure un mot. Les dates suivent le fuseau de votre appareil.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="search-results">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                open(r.channel_id, r.id);
                close();
              }}
            >
              <small>
                #{r.channel_name} · {r.author_name}
              </small>
              <p>{r.content}</p>
              <Time value={r.created_at} />
            </button>
          ))}
        </div>
        {searched && !rows.length && !busy && (
          <p>Aucun message pour « {searched} ».</p>
        )}
        {cursor && (
          <button disabled={busy} onClick={() => void search(true)}>
            Plus de résultats
          </button>
        )}
      </div>
    </Modal>
  );
}
export function ChannelAccess({
  base,
  channel,
  close,
  refresh,
}: {
  base: string;
  channel: Row;
  close: () => void;
  refresh: () => void;
}) {
  const [groups, setGroups] = useState<Row[]>([]),
    [groupIds, setGroupIds] = useState<string[]>([]);
  const [members, setMembers] = useState<Row[]>([]),
    [ids, setIds] = useState<string[]>([]),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let gone = false;
    void api<Result>(`${base}/channels/${channel.id}/groups`)
      .then((r) => {
        if (!gone) {
          setGroups(r.data);
          setGroupIds(r.data.filter((g) => g.enabled).map((g) => g.id));
        }
      })
      .catch((e) => setError(e.message));
    void Promise.all([
      collection(`${base}/members`),
      api<Result>(`${base}/channels/${channel.id}/access`),
    ])
      .then(([m, a]) => {
        if (gone) return;
        setMembers(m.data);
        setIds(a.data.map((x) => x.id));
        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      gone = true;
    };
  }, [base, channel.id]);
  return (
    <Modal title={`Accès à ${channel.name}`} onClose={close}>
      <div className="collaboration-panel">
        <p>
          Seuls les membres sélectionnés et les gestionnaires de salons peuvent
          ouvrir ce salon privé. La permission de supervision reste requise pour
          un salon de monitoring.
        </p>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`${base}/channels/${channel.id}/access`, "PUT", {
                user_ids: ids,
              });
              await api(`${base}/channels/${channel.id}/groups`, "PUT", {
                group_ids: groupIds,
              });
              refresh();
              close();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {groups.length > 0 && (
            <fieldset>
              <legend>Groupes autorisés</legend>
              {groups.map((g) => (
                <label className="check-line" key={g.id}>
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={(e) =>
                      setGroupIds((old) =>
                        e.target.checked
                          ? [...old, g.id]
                          : old.filter((id) => id !== g.id),
                      )
                    }
                  />
                  {g.name}
                </label>
              ))}
            </fieldset>
          )}
          {members.map((m) => (
            <label className="check-line" key={m.id}>
              <input
                type="checkbox"
                checked={ids.includes(m.id)}
                onChange={(e) =>
                  setIds((old) =>
                    e.target.checked
                      ? [...old, m.id]
                      : old.filter((x) => x !== m.id),
                  )
                }
              />
              {m.name}
            </label>
          ))}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={!ready || busy}>
            Enregistrer les accès
          </button>
        </form>
      </div>
    </Modal>
  );
}
