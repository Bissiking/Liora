// src/client/Notes.tsx
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Pencil, Trash2, StickyNote } from "lucide-react";
import { api } from "./api";
import { Markdown } from "./Markdown";
import { Empty, FormDialog, type Field } from "./ui";
import { instantFromLocal, localDateTime } from "../shared/schedule";
import type { Row } from "./types";
type Note = Row & {
  due_at: string;
  source: "liora" | "braindump";
  content: string;
};
type Connection = {
  configured: boolean;
  available: {
    id: string;
    name: string;
    workspace_id: string;
    workspace_name: string;
    state: string;
    connected: boolean;
  }[];
  data: {
    integration_id?: string | null;
    enabled: boolean;
    last_synced_at: string | null;
    last_error: string | null;
  };
};
export function Notes() {
  const [notes, setNotes] = useState<Note[]>([]),
    [connection, setConnection] = useState<Connection | null>(null),
    [cursor, setCursor] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selectedIntegration, setIntegration] = useState("");
  const [form, setForm] = useState<{
    title: string;
    fields: Field[];
    save: (data: Record<string, string>) => Promise<void>;
  } | null>(null);
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  async function load() {
    const [n, c] = await Promise.all([
      api<{ data: Note[]; nextCursor: string | null }>("/api/v1/notes"),
      api<Connection>("/api/v1/braindump"),
    ]);
    setNotes(n.data);
    setCursor(n.nextCursor);
    setConnection(c);
    setIntegration(
      (current) =>
        c.data.integration_id || current || c.available?.[0]?.id || "",
    );
  }
  useEffect(() => {
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!connection?.data.enabled) return;
    const timer = setInterval(() => {
      if (!document.hidden) void sync();
    }, 60000);
    return () => clearInterval(timer);
  }, [connection?.data.enabled, busy]);
  async function sync() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/braindump/sync", "POST");
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load().catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  function edit(note?: Note) {
    setForm({
      title: note ? "Modifier la note" : "Nouvelle note datée",
      fields: [
        {
          key: "title",
          label: "Titre",
          value: note?.title,
          required: true,
          maxLength: 200,
        },
        {
          key: "due_at",
          label: "Date et heure",
          type: "datetime-local",
          required: true,
          value: localDateTime(note?.due_at || new Date(), zone),
        },
        {
          key: "content",
          label: "Note",
          required: false,
          type: "textarea",
          value: note?.content,
          maxLength: 20000,
        },
      ],
      save: async (d) => {
        await api(
          "/api/v1/notes" + (note ? "/" + note.id : ""),
          note ? "PATCH" : "POST",
          {
            title: d.title,
            content: d.content,
            due_at: instantFromLocal(d.due_at, zone),
          },
        );
        await load();
      },
    });
  }
  const visible = notes.filter((n) =>
    (n.title + " " + n.content)
      .toLocaleLowerCase("fr")
      .includes(search.toLocaleLowerCase("fr")),
  );
  return (
    <div className="page notes-page">
      <header className="page-heading">
        <div>
          <h1>Notes datées</h1>
          <p>Vos idées et leurs rendez-vous, dans votre espace personnel.</p>
        </div>
        <button className="primary" onClick={() => edit()}>
          <Plus size={16} />
          Nouvelle note
        </button>
      </header>
      <section className="notes-connection" aria-label="Lien BrainDump">
        <div>
          <h2>BrainDump</h2>
          <p>
            {connection?.configured
              ? "Retrouvez ici vos notes avec une date. Leur contenu se modifie dans BrainDump."
              : connection?.available?.length
                ? "Connectez votre compte BrainDump ci-contre pour autoriser la lecture de vos notes datées."
                : "Un administrateur peut ajouter BrainDump dans Administration → Intégrations."}
          </p>
          {connection?.data.last_synced_at && (
            <small>
              Dernière récupération :{" "}
              {new Date(connection.data.last_synced_at).toLocaleString("fr-FR")}{" "}
              · actualisation chaque minute quand cette page est ouverte.
            </small>
          )}
        </div>
        <div className="notes-connection-actions">
          {!!connection?.available?.length && (
            <label>
              Intégration BrainDump
              <select
                value={selectedIntegration}
                disabled={busy || connection.data.enabled}
                onChange={(e) => setIntegration(e.target.value)}
              >
                {connection.available.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.workspace_name} · {i.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {connection?.available?.find((i) => i.id === selectedIntegration)
            ?.state === "connected" && (
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  const i = connection.available.find(
                    (i) => i.id === selectedIntegration,
                  )!;
                  const r = await api<{ url: string }>(
                    `/api/v1/workspaces/${i.workspace_id}/connections/${i.id}/start`,
                    "POST",
                    {},
                  );
                  location.assign(r.url);
                } catch (e) {
                  setError((e as Error).message);
                  setBusy(false);
                }
              }}
            >
              {connection.available.find((i) => i.id === selectedIntegration)
                ?.connected
                ? "Renouveler l’autorisation BrainDump"
                : "Connecter mon compte BrainDump"}
            </button>
          )}
          <label className="check-line">
            <input
              type="checkbox"
              checked={connection?.data.enabled || false}
              disabled={
                busy ||
                (!connection?.data.enabled &&
                  (selectedIntegration
                    ? !connection?.available.find(
                        (i) =>
                          i.id === selectedIntegration &&
                          i.connected &&
                          i.state === "connected",
                      )
                    : !connection?.configured))
              }
              onChange={async (e) => {
                const enabled = e.target.checked;
                setBusy(true);
                setError("");
                try {
                  await api("/api/v1/braindump", "PUT", {
                    enabled,
                    integration_id: selectedIntegration || null,
                  });
                  if (enabled) await api("/api/v1/braindump/sync", "POST");
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                  await load().catch(() => {});
                } finally {
                  setBusy(false);
                }
              }}
            />
            Lier mes notes BrainDump
          </label>
          <button
            disabled={busy || !connection?.data.enabled}
            onClick={() => void sync()}
          >
            <RefreshCw size={15} />
            {busy ? "Récupération…" : "Actualiser"}
          </button>
        </div>
      </section>
      {(error || connection?.data.last_error) && (
        <p className="error" role="alert">
          {error || connection?.data.last_error}
        </p>
      )}
      <label className="notes-search">
        Rechercher une note
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="search"
          placeholder="Titre ou contenu…"
        />
      </label>
      <p className="muted">
        {visible.length} note(s) affichée(s) · horaires en {zone}
      </p>
      {loading ? (
        <p role="status">Chargement des notes…</p>
      ) : !visible.length ? (
        <Empty
          title={
            search
              ? "Aucune note ne correspond à cette recherche."
              : "Ajoutez une note datée ou liez BrainDump pour commencer."
          }
        />
      ) : (
        <div className="dated-notes">
          {visible.map((n) => (
            <article className="dated-note" key={n.id}>
              <time dateTime={n.due_at}>
                {new Date(n.due_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                <small>
                  {new Date(n.due_at).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </time>
              <div>
                <div className="dated-note-heading">
                  <h2>{n.title}</h2>
                  <span className="tag">
                    {n.source === "braindump" ? "BrainDump" : "Liora"}
                  </span>
                </div>
                <Markdown text={n.content} />
              </div>
              {n.source === "liora" && (
                <div className="dated-note-actions">
                  <button
                    aria-label={"Modifier " + n.title}
                    onClick={() => edit(n)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="danger"
                    aria-label={"Supprimer " + n.title}
                    onClick={async () => {
                      if (!confirm("Supprimer cette note ?")) return;
                      try {
                        await api("/api/v1/notes/" + n.id, "DELETE");
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      {cursor && (
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ data: Note[]; nextCursor: string | null }>(
                "/api/v1/notes?before=" + cursor,
              );
              setNotes((old) => [...old, ...r.data]);
              setCursor(r.nextCursor);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Notes suivantes
        </button>
      )}
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}
    </div>
  );
}
