// src/client/Pages.tsx
import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  History,
} from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
import { Empty, FormDialog } from "./ui";
type Block = Row["blocks"][number];
function Embed({
  base,
  page,
  block,
  revision,
  draft = false,
}: {
  base: string;
  page: string;
  block: Block;
  revision: number;
  draft?: boolean;
}) {
  const [data, setData] = useState<Record<string, unknown> | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let gone = false;
    void api<{ data: Record<string, unknown> }>(
      `${base}/pages/${page}/embeds/${block.id}${draft ? `?draft=true&type=${block.type}&content=${encodeURIComponent(block.content)}` : ""}`,
    )
      .then((r) => {
        if (!gone) {
          setData(r.data);
          setError("");
        }
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [base, page, block.id, block.content, revision, draft]);
  if (error)
    return <p className="embed-unavailable">Contenu indisponible : {error}</p>;
  if (!data) return <p>Chargement du contenu…</p>;
  if (block.type === "board")
    return (
      <section className="embedded-board">
        <h3>{String(data.name)}</h3>
        <div>
          {(
            data.columns as {
              id: string;
              name: string;
              tasks: { id: string; title: string; priority: string }[];
            }[]
          ).map((c) => (
            <section key={c.id}>
              <h4>{c.name}</h4>
              {c.tasks.map((t) => (
                <p key={t.id}>
                  {t.title}
                  <small>{t.priority === "urgent" ? "Urgent" : ""}</small>
                </p>
              ))}
            </section>
          ))}
        </div>
      </section>
    );
  if (block.type === "message")
    return (
      <blockquote>
        <strong>{String(data.author_name || "Message")}</strong>
        <p>{String(data.content)}</p>
      </blockquote>
    );
  if (block.type === "stats")
    return (
      <dl className="embedded-stats">
        <div>
          <dt>Tâches de l’espace</dt>
          <dd>{String(data.total)}</dd>
        </div>
        <div>
          <dt>Échéance dépassée</dt>
          <dd>{String(data.overdue)}</dd>
        </div>
        <div>
          <dt>Priorité haute ou urgente</dt>
          <dd>{String(data.priority)}</dd>
        </div>
      </dl>
    );
  return (
    <a
      className="link-preview"
      href={String(data.url)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <strong>{String(data.name)}</strong>
      <span>
        {data.enabled ? "Intégration active" : "Intégration désactivée"}
      </span>
    </a>
  );
}
function ReadBlock({
  b,
  base,
  page,
  revision,
  draft = false,
}: {
  b: Block;
  base: string;
  page: string;
  revision: number;
  draft?: boolean;
}) {
  if (["board", "message", "stats", "integration"].includes(b.type))
    return (
      <Embed
        base={base}
        page={page}
        block={b}
        revision={revision}
        draft={draft}
      />
    );
  switch (b.type) {
    case "heading":
      return <h2>{b.content}</h2>;
    case "divider":
      return <hr />;
    case "code":
      return (
        <pre>
          <code>{b.content}</code>
        </pre>
      );
    case "quote":
      return <blockquote>{b.content}</blockquote>;
    case "checklist":
      return (
        <label className="check-line">
          <input type="checkbox" checked={!!b.checked} readOnly disabled />
          {b.content}
        </label>
      );
    case "list":
      return (
        <ul>
          {b.content
            .split("\n")
            .filter(Boolean)
            .map((s, i) => (
              <li key={i}>{s.replace(/^[-*] /, "")}</li>
            ))}
        </ul>
      );
    case "link":
      return /^https?:\/\//.test(b.content) ? (
        <a href={b.content} target="_blank" rel="noopener noreferrer">
          {b.content}
        </a>
      ) : (
        <p>{b.content}</p>
      );
    default:
      return <p>{b.content}</p>;
  }
}
const types = [
  ["text", "Texte"],
  ["heading", "Titre"],
  ["list", "Liste"],
  ["checklist", "Checklist"],
  ["code", "Code"],
  ["quote", "Citation"],
  ["divider", "Séparateur"],
  ["link", "Lien"],
  ["board", "Board"],
  ["message", "Message"],
  ["stats", "Statistiques des tâches"],
  ["integration", "Intégration"],
];
export function Pages({
  initialPage = "",
  base,
  can,
  revision,
  refresh,
  fail,
}: {
  initialPage?: string;
  base: string;
  can: (p: string) => boolean;
  revision: number;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const [pageQuery, setPageQuery] = useState("");
  const [pages, setPages] = useState<Row[]>([]),
    [selected, setSelected] = useState(""),
    [blocks, setBlocks] = useState<Block[]>([]),
    [baseline, setBaseline] = useState<{
      blocks: Block[];
      revision: number;
    } | null>(null),
    [dirty, setDirty] = useState(false),
    [create, setCreate] = useState(false),
    [saving, setSaving] = useState(false),
    [preview, setPreview] = useState(!can("MANAGE_PAGES")),
    [historyOpen, setHistoryOpen] = useState(false),
    [history, setHistory] = useState<Row[]>([]),
    [comments, setComments] = useState<Row[]>([]),
    [comment, setComment] = useState(""),
    [boards, setBoards] = useState<Row[]>([]),
    [integrations, setIntegrations] = useState<Row[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let gone = false;
    void collection(`${base}/pages`)
      .then((r) => {
        if (gone) return;
        setPages(r.data);
        setSelected((old) =>
          r.data.some((p) => p.id === old)
            ? old
            : r.data.some((p) => p.id === initialPage)
              ? initialPage
              : r.data[0]?.id || "",
        );
      })
      .catch(fail);
    return () => {
      gone = true;
    };
  }, [base, revision]);
  const page = pages.find((p) => p.id === selected),
    edit = can("MANAGE_PAGES");
  useEffect(() => {
    if (!dirty && page) {
      setBlocks(page.blocks);
      setBaseline({ blocks: page.blocks, revision: page.revision });
    }
  }, [page, dirty]);
  useEffect(() => {
    if (!selected) return;
    let gone = false;
    void Promise.all([
      api<Result>(`${base}/pages/${selected}/history`),
      api<Result>(`${base}/pages/${selected}/comments`),
    ])
      .then(([h, c]) => {
        if (!gone) {
          setHistory(h.data);
          setComments(c.data);
        }
      })
      .catch(fail);
    return () => {
      gone = true;
    };
  }, [selected, revision]);
  useEffect(() => {
    if (can("VIEW_BOARD"))
      void collection(`${base}/boards`)
        .then((r) => setBoards(r.data))
        .catch(fail);
    if (can("VIEW_WEBHOOKS"))
      void api<Result>(`${base}/outbound`)
        .then((r) => setIntegrations(r.data))
        .catch(fail);
  }, [base]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (next: Block[]) => {
    setBlocks(next);
    setDirty(true);
  };
  const modify = (i: number, next: Partial<Block>) =>
    change(blocks.map((b, j) => (j === i ? { ...b, ...next } : b)));
  async function save() {
    if (!page || !baseline) return;
    setSaving(true);
    setError("");
    try {
      const r = await api<{ data: Row }>(`${base}/pages/${page.id}`, "PATCH", {
        blocks,
        revision: baseline.revision,
        base_blocks: baseline.blocks,
      });
      setPages((old) => old.map((p) => (p.id === r.data.id ? r.data : p)));
      setBlocks(r.data.blocks);
      setBaseline({ blocks: r.data.blocks, revision: r.data.revision });
      setDirty(false);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="pages-layout">
      <aside className="page-list">
        <header>
          <h2>Les pages</h2>
          {edit && (
            <button
              className="icon-button"
              aria-label="Nouvelle page"
              onClick={() => setCreate(true)}
            >
              <Plus size={18} />
            </button>
          )}
        </header>
        <input
          type="search"
          aria-label="Rechercher une page"
          placeholder="Trouver une page…"
          value={pageQuery}
          onChange={(e) => setPageQuery(e.target.value)}
        />
        {pageQuery &&
          !pages.some((p) =>
            p.title
              .toLocaleLowerCase("fr")
              .includes(pageQuery.toLocaleLowerCase("fr")),
          ) && <p className="muted">Aucune page ne correspond.</p>}
        {pages
          .filter((p) =>
            p.title
              .toLocaleLowerCase("fr")
              .includes(pageQuery.toLocaleLowerCase("fr")),
          )
          .map((p) => (
            <button
              key={p.id}
              className={selected === p.id ? "active" : ""}
              disabled={dirty && selected !== p.id}
              onClick={() => {
                setSelected(p.id);
                setDirty(false);
                setError("");
              }}
            >
              <FileText size={16} />
              {p.title}
            </button>
          ))}
      </aside>
      <section className="document">
        {page ? (
          <>
            <header>
              <FileText size={35} />
              <h1>{page.title}</h1>
              <p>Une mémoire commune, une équipe qui avance.</p>
            </header>
            <div className="document-modes">
              {edit && (
                <button
                  aria-pressed={preview}
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? <Pencil size={16} /> : <Eye size={16} />}{" "}
                  {preview ? "Modifier" : "Aperçu"}
                </button>
              )}
              <button
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <History size={16} />
                Historique
              </button>
              <small>
                {preview
                  ? dirty
                    ? "Aperçu de votre brouillon — non publié"
                    : "Mode lecture — version publiée"
                  : "Édition par blocs · conflits protégés"}
              </small>
            </div>
            {historyOpen && (
              <section className="page-history">
                <h2>Versions précédentes</h2>
                {history.length ? (
                  history.map((h) => (
                    <div key={h.revision}>
                      <span>
                        Révision {h.revision} ·{" "}
                        {new Date(h.created_at).toLocaleString("fr-FR")}
                      </span>
                      {edit && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Restaurer cette version dans votre brouillon ?",
                              )
                            ) {
                              change(h.blocks);
                              setPreview(false);
                            }
                          }}
                        >
                          Restaurer dans le brouillon
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p>Aucune version précédente.</p>
                )}
              </section>
            )}
            <div className="document-blocks">
              {blocks.map((b, i) => (
                <div
                  key={b.id || i}
                  className={`document-block block-${b.type}`}
                >
                  {preview || !edit ? (
                    <ReadBlock
                      b={b}
                      base={base}
                      page={page.id}
                      revision={revision}
                      draft={dirty && edit}
                    />
                  ) : (
                    <>
                      {b.type === "divider" ? (
                        <hr />
                      ) : ["board", "integration"].includes(b.type) ? (
                        <label>
                          {b.type === "board"
                            ? "Board à afficher"
                            : "Intégration à afficher"}
                          <select
                            value={b.content}
                            onChange={(e) =>
                              modify(i, { content: e.target.value })
                            }
                          >
                            <option value="">Choisir…</option>
                            {(b.type === "board" ? boards : integrations).map(
                              (x) => (
                                <option key={x.id} value={x.id}>
                                  {x.name}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      ) : b.type === "stats" ? (
                        <p>
                          Statistiques des tâches de cet espace, selon les
                          droits du lecteur.
                        </p>
                      ) : (
                        <>
                          {b.type === "checklist" && (
                            <input
                              type="checkbox"
                              checked={!!b.checked}
                              onChange={(e) =>
                                modify(i, { checked: e.target.checked })
                              }
                            />
                          )}
                          <label
                            className="visually-hidden"
                            htmlFor={`block-${b.id}`}
                          >
                            Bloc {i + 1} {b.type}
                          </label>
                          <textarea
                            id={`block-${b.id}`}
                            aria-label={`Bloc ${i + 1} ${b.type}`}
                            placeholder={
                              b.type === "message"
                                ? "Identifiant du message (copié depuis le chat)"
                                : b.type === "link"
                                  ? "https://…"
                                  : "Votre contenu…"
                            }
                            value={b.content}
                            rows={b.type === "heading" ? 1 : 2}
                            onChange={(e) =>
                              modify(i, { content: e.target.value })
                            }
                          />
                        </>
                      )}
                      <div className="block-actions">
                        <button
                          className="icon-button"
                          aria-label="Monter le bloc"
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...blocks];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            change(next);
                          }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Descendre le bloc"
                          disabled={i === blocks.length - 1}
                          onClick={() => {
                            const next = [...blocks];
                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                            change(next);
                          }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Supprimer le bloc"
                          onClick={() =>
                            change(blocks.filter((_, j) => i !== j))
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {edit && (!preview || dirty) && (
              <div className="document-toolbar">
                {!preview && (
                  <select
                    aria-label="Ajouter un bloc"
                    value=""
                    onChange={(e) =>
                      change([
                        ...blocks,
                        {
                          id: crypto.randomUUID(),
                          type: e.target.value,
                          content: e.target.value === "divider" ? "—" : "",
                        },
                      ])
                    }
                  >
                    <option value="" disabled>
                      Ajouter un bloc…
                    </option>
                    {types.map(([t, label]) => (
                      <option key={t} value={t}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="primary"
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  <Save size={16} />
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                {dirty && (
                  <button
                    onClick={() => {
                      setDirty(false);
                      setError("");
                      setBlocks(page.blocks);
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            )}
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <small className="muted">
              Révision {page.revision} ·{" "}
              {dirty
                ? "Modifications non enregistrées"
                : `Enregistrée le ${new Date(page.updated_at).toLocaleString("fr-FR")}`}
            </small>
            <section className="page-comments">
              <h2>Commentaires</h2>
              {comments.map((c) => (
                <article key={c.id}>
                  <strong>{c.name}</strong>
                  <p>{c.content}</p>
                </article>
              ))}
              <form
                className="inline-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    await api(`${base}/pages/${page.id}/comments`, "POST", {
                      content: comment,
                    });
                    setComment("");
                    refresh();
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                <input
                  aria-label="Commentaire sur la page"
                  placeholder="Une précision, une question…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  maxLength={4000}
                />
                <button>Commenter</button>
              </form>
            </section>
          </>
        ) : (
          <Empty title="Gardez une trace de vos idées">
            Les décisions, les guides et les notes de l’équipe, réunis ici.
          </Empty>
        )}
      </section>
      {create && (
        <FormDialog
          title="Nouvelle page"
          fields={[{ key: "title", label: "Titre" }]}
          onSave={async (d) => {
            const r = await api<{ data: Row }>(`${base}/pages`, "POST", d);
            refresh();
            setSelected(r.data.id);
          }}
          onClose={() => setCreate(false)}
        />
      )}
    </div>
  );
}
