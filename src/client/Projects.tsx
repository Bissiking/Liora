// src/client/Projects.tsx
import { useEffect, useState, useRef } from "react";
import {
  Plus,
  MoreHorizontal,
  Calendar,
  ArrowRight,
  GripVertical,
  CheckSquare,
  Link as LinkIcon,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
import { Empty, FormDialog, Modal, type Field } from "./ui";
import { TaskExtras } from "./TaskExtras";
export function Projects({
  initialProject = "",
  initialTask = "",
  base,
  can,
  revision,
  refresh,
  fail,
}: {
  initialProject?: string;
  initialTask?: string;
  base: string;
  can: (p: string) => boolean;
  revision: number;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const handledTarget = useRef("");
  const [layout, setLayout] = useState("board"),
    [priorityFilter, setPriorityFilter] = useState(""),
    [assigneeFilter, setAssigneeFilter] = useState(""),
    [dueFilter, setDueFilter] = useState(""),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [showArchived, setShowArchived] = useState(false),
    [templates, setTemplates] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Row[]>([]),
    [boards, setBoards] = useState<Row[]>([]),
    [columns, setColumns] = useState<Row[]>([]),
    [tasks, setTasks] = useState<Row[]>([]),
    [members, setMembers] = useState<Row[]>([]),
    [project, setProject] = useState(""),
    [board, setBoard] = useState(""),
    [filter, setFilter] = useState(""),
    [selected, setSelected] = useState<Row | null>(null),
    [form, setForm] = useState<{
      title: string;
      fields: Field[];
      save: (d: Record<string, string>) => Promise<void>;
    } | null>(null);
  useEffect(() => {
    let gone = false;
    setLoading(true);
    setLoadError("");
    Promise.all(
      ["projects", "boards", "columns", "tasks", "members"].map((r) =>
        ["boards", "columns", "tasks"].includes(r) && !can("VIEW_BOARD")
          ? Promise.resolve({ data: [] })
          : collection(`${base}/${r}`),
      ),
    )
      .then(([p, b, c, t, m]) => {
        if (gone) return;
        setProjects(p.data);
        setBoards(b.data);
        setColumns(c.data);
        setTasks(t.data);
        setMembers(m.data);
        setProject((old) =>
          p.data.some((x) => x.id === old)
            ? old
            : p.data.some((x) => x.id === initialProject)
              ? initialProject
              : p.data[0]?.id || "",
        );
        setBoard((old) =>
          b.data.some((x) => x.id === old) ? old : b.data[0]?.id || "",
        );
        setSelected((old) =>
          old ? t.data.find((x) => x.id === old.id) || null : null,
        );
      })
      .catch((e) => {
        if (!gone) setLoadError(e.message);
      })
      .finally(() => {
        if (!gone) setLoading(false);
      });
    return () => {
      gone = true;
    };
  }, [base, revision]);
  useEffect(() => {
    if (initialProject) setProject(initialProject);
  }, [initialProject]);
  useEffect(() => {
    const key = `${base}/${initialTask}`;
    if (!initialTask || handledTarget.current === key) return;
    const t = tasks.find((t) => t.id === initialTask),
      c = columns.find((c) => c.id === t?.column_id),
      b = boards.find((b) => b.id === c?.board_id);
    if (t && b) {
      handledTarget.current = key;
      setSelected(t);
      setBoard(b.id);
      setProject(b.project_id || "unassigned");
    }
  }, [base, initialTask, tasks, boards, columns]);
  useEffect(() => {
    if (!can("VIEW_BOARD")) return;
    void collection(`${base}/templates`)
      .then((r) => setTemplates(r.data))
      .catch(fail);
  }, [base, revision]);
  const activeProjects = projects.filter((p) => showArchived || !p.archived);
  const projectId =
    project === "unassigned" || activeProjects.some((p) => p.id === project)
      ? project
      : activeProjects[0]?.id || "";
  const activeBoards = boards.filter(
    (b) =>
      (showArchived || !b.archived) &&
      b.project_id === (projectId === "unassigned" ? null : projectId || null),
  );
  const activeBoard =
    activeBoards.find((b) => b.id === board) || activeBoards[0];
  const create = (
    resource: string,
    title: string,
    fields: Field[],
    extra: Record<string, unknown> = {},
  ) =>
    setForm({
      title,
      fields:
        resource === "tasks"
          ? [
              ...fields,
              {
                key: "template",
                label: "Modèle",
                required: false,
                options: [
                  { value: "", label: "Sans modèle" },
                  ...templates.map((t) => ({ value: t.id, label: t.name })),
                ],
              },
            ]
          : fields,
      save: async (d) => {
        const { template, ...rest } = d;
        const t = templates.find((t) => t.id === template);
        const created = await api<{ data: Row }>(
          `${base}/${resource}`,
          "POST",
          {
            ...(t
              ? {
                  description: t.description,
                  checklist: t.checklist,
                  tags: t.tags,
                  priority: t.priority,
                }
              : {}),
            ...extra,
            ...rest,
          },
        );
        if (resource === "projects") setProject(created.data.id);
        if (resource === "boards") setBoard(created.data.id);
        refresh();
      },
    });
  async function move(task: Row, column: string) {
    try {
      await api(`${base}/tasks/${task.id}`, "PATCH", {
        revision: task.revision,
        column_id: column,
        position:
          Math.max(
            0,
            ...tasks
              .filter((t) => t.column_id === column)
              .map((t) => t.position),
          ) + 1,
      });
      refresh();
    } catch (e) {
      fail(e);
    }
  }
  return (
    <div className="page project-page">
      <header className="page-heading">
        <div>
          <h1>Projets</h1>
          <p>
            Organisez vos tâches et suivez leur progression dans vos tableaux.
          </p>
        </div>
        {can("CREATE_PROJECT") && (
          <button
            className="primary"
            onClick={() =>
              create("projects", "Nouveau projet", [
                { key: "name", label: "Nom" },
                {
                  key: "description",
                  label: "Description",
                  type: "textarea",
                  required: false,
                },
              ])
            }
          >
            <Plus size={17} />
            Nouveau projet
          </button>
        )}
      </header>
      {loading && <p role="status">Chargement des projets…</p>}
      {loadError && (
        <p role="alert" className="error">
          {loadError} <button onClick={refresh}>Réessayer</button>
        </p>
      )}
      <details className="project-options">
        <summary>Options du projet</summary>
        <div className="section-toolbar">
          <label className="check-line">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Afficher les archives
          </label>
          {projectId && projectId !== "unassigned" && can("MANAGE_PROJECT") && (
            <button
              onClick={() => {
                const p = projects.find((p) => p.id === projectId)!;
                setForm({
                  title: "Réglages du projet",
                  fields: [
                    { key: "name", label: "Nom", value: p.name },
                    {
                      key: "description",
                      label: "Description",
                      type: "textarea",
                      required: false,
                      value: p.description,
                    },
                    {
                      key: "archived",
                      label: "État",
                      value: String(p.archived),
                      options: [
                        { value: "false", label: "Actif" },
                        { value: "true", label: "Archivé" },
                      ],
                    },
                  ],
                  save: async (d) => {
                    await api(`${base}/projects/${p.id}`, "PATCH", {
                      name: d.name,
                      description: d.description,
                      archived: d.archived === "true",
                    });
                    refresh();
                  },
                });
              }}
            >
              Modifier le projet
            </button>
          )}
          {projectId &&
            projectId !== "unassigned" &&
            can("MANAGE_PROJECT") &&
            can("MANAGE_BOARD") &&
            can("MANAGE_TASK") && (
              <button
                className="danger"
                onClick={() => {
                  if (
                    confirm(
                      "Supprimer ce projet et ses données associées ? Cette action est définitive.",
                    )
                  )
                    void api(`${base}/projects/${projectId}`, "DELETE")
                      .then(refresh)
                      .catch(fail);
                }}
              >
                Supprimer le projet
              </button>
            )}
        </div>
      </details>
      <div className="project-tabs" aria-label="Choisir un projet">
        {boards.some((b) => !b.project_id && (showArchived || !b.archived)) && (
          <button
            className={projectId === "unassigned" ? "active" : ""}
            onClick={() => {
              setProject("unassigned");
              setBoard("");
            }}
          >
            Sans projet
          </button>
        )}
        {activeProjects.map((p) => (
          <button
            key={p.id}
            className={projectId === p.id ? "active" : ""}
            aria-label={p.name}
            aria-pressed={projectId === p.id}
            onClick={() => {
              setProject(p.id);
              setBoard("");
            }}
          >
            <span className="project-monogram">{p.name.slice(0, 1)}</span>
            {p.name}
            {p.archived ? " · Archivé" : ""}
          </button>
        ))}
      </div>
      {!activeProjects.length && !boards.some((b) => !b.project_id) ? (
        <Empty title="Votre première idée mérite un projet">
          Créez un projet pour réunir vos boards et vos pages.
        </Empty>
      ) : (
        <>
          <div className="project-context">
            <h2>
              {projects.find((p) => p.id === projectId)?.name ||
                "Tableaux sans projet"}
            </h2>
            <p>
              {projects.find((p) => p.id === projectId)?.description ||
                "Un projet, plusieurs tableaux pour avancer ensemble."}
            </p>
          </div>
          <div className="board-toolbar">
            <select
              aria-label="Board"
              value={activeBoard?.id || ""}
              onChange={(e) => setBoard(e.target.value)}
            >
              {activeBoards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Filtrer les cartes…"
              aria-label="Filtrer les cartes"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {can("CREATE_BOARD") && (
              <button
                onClick={() =>
                  create(
                    "boards",
                    "Nouveau board",
                    [{ key: "name", label: "Nom du board" }],
                    {
                      project_id: projectId === "unassigned" ? null : projectId,
                    },
                  )
                }
              >
                <Plus size={16} />
                Board
              </button>
            )}
            {activeBoard && can("MANAGE_BOARD") && (
              <button
                onClick={() =>
                  create(
                    "columns",
                    "Nouvelle colonne",
                    [{ key: "name", label: "Nom" }],
                    {
                      board_id: activeBoard.id,
                      position:
                        Math.max(
                          -1,
                          ...columns
                            .filter((c) => c.board_id === activeBoard.id)
                            .map((c) => c.position),
                        ) + 1,
                    },
                  )
                }
              >
                <Plus size={16} />
                Colonne
              </button>
            )}
          </div>
          {activeBoard && can("MANAGE_BOARD") && (
            <details className="board-management">
              <summary>Options du tableau</summary>
              <button
                onClick={() =>
                  setForm({
                    title: "Réglages du board",
                    fields: [
                      { key: "name", label: "Nom", value: activeBoard.name },
                      {
                        key: "project_id",
                        label: "Projet",
                        value: activeBoard.project_id || "",
                        options: [
                          { value: "", label: "Sans projet" },
                          ...activeProjects.map((p) => ({
                            value: p.id,
                            label: p.name,
                          })),
                        ],
                      },
                      {
                        key: "archived",
                        label: "État",
                        value: String(activeBoard.archived),
                        options: [
                          { value: "false", label: "Actif" },
                          { value: "true", label: "Archivé" },
                        ],
                      },
                    ],
                    save: async (d) => {
                      await api(`${base}/boards/${activeBoard.id}`, "PATCH", {
                        name: d.name,
                        project_id: d.project_id || null,
                        archived: d.archived === "true",
                      });
                      refresh();
                    },
                  })
                }
              >
                Modifier le board
              </button>
              <button
                onClick={() => {
                  if (
                    confirm("Supprimer ce board, ses colonnes et ses tâches ?")
                  )
                    void api(`${base}/boards/${activeBoard.id}`, "DELETE")
                      .then(refresh)
                      .catch(fail);
                }}
              >
                Supprimer le board
              </button>
            </details>
          )}
          <div className="task-filters">
            <div className="segmented">
              <button
                aria-pressed={layout === "board"}
                onClick={() => setLayout("board")}
              >
                Tableau
              </button>
              <button
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
              >
                Liste
              </button>
            </div>
            <select
              aria-label="Filtrer par priorité"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="">Toutes les priorités</option>
              <option value="urgent">Urgente</option>
              <option value="high">Haute</option>
              <option value="normal">Normale</option>
              <option value="low">Basse</option>
            </select>
            <select
              aria-label="Filtrer par responsable"
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
            >
              <option value="">Tous les responsables</option>
              <option value="unassigned">Sans responsable</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrer par échéance"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value)}
            >
              <option value="">Toutes les échéances</option>
              <option value="late">En retard</option>
              <option value="week">Dans les 7 jours</option>
              <option value="none">Sans échéance</option>
            </select>
            {(filter || priorityFilter || assigneeFilter || dueFilter) && (
              <button
                onClick={() => {
                  setFilter("");
                  setPriorityFilter("");
                  setAssigneeFilter("");
                  setDueFilter("");
                }}
              >
                Effacer les filtres
              </button>
            )}
          </div>
          <div
            className={`kanban ${layout === "list" ? "task-list-view" : ""}`}
          >
            {columns
              .filter((c) => c.board_id === activeBoard?.id)
              .map((c, index) => {
                const cards = tasks
                  .filter(
                    (t) =>
                      t.column_id === c.id &&
                      `${t.title} ${t.description} ${t.tags.join(" ")}`
                        .toLowerCase()
                        .includes(filter.toLowerCase()) &&
                      (!priorityFilter || t.priority === priorityFilter) &&
                      (!assigneeFilter ||
                        (assigneeFilter === "unassigned"
                          ? !t.assignee
                          : t.assignee === assigneeFilter)) &&
                      (!dueFilter ||
                        (dueFilter === "none"
                          ? !t.due_at
                          : !!t.due_at &&
                            (dueFilter === "late"
                              ? Date.parse(t.due_at) < Date.now()
                              : Date.parse(t.due_at) >= Date.now() &&
                                Date.parse(t.due_at) <=
                                  Date.now() + 7 * 86400000))),
                  )
                  .sort((a, b) => a.position - b.position);
                return (
                  <section
                    key={c.id}
                    className="kanban-column"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const task = tasks.find(
                        (t) => t.id === e.dataTransfer.getData("text/plain"),
                      );
                      if (task && can("MANAGE_TASK")) void move(task, c.id);
                    }}
                  >
                    <header>
                      <span className={`column-status status-${index % 3}`} />
                      <h2>{c.name}</h2>
                      <span>{cards.length}</span>
                      {can("CREATE_TASK") && (
                        <button
                          className="icon-button"
                          aria-label={`Ajouter une tâche dans ${c.name}`}
                          onClick={() =>
                            create(
                              "tasks",
                              "Nouvelle tâche",
                              [
                                { key: "title", label: "Titre" },
                                {
                                  key: "description",
                                  label: "Description",
                                  type: "textarea",
                                  required: false,
                                },
                              ],
                              {
                                column_id: c.id,
                                position:
                                  Math.max(
                                    -1,
                                    ...tasks
                                      .filter((t) => t.column_id === c.id)
                                      .map((t) => t.position),
                                  ) + 1,
                              },
                            )
                          }
                        >
                          <Plus size={16} />
                        </button>
                      )}
                    </header>
                    <div className="column-cards">
                      {cards.map((t) => (
                        <article
                          key={t.id}
                          className="task-card"
                          draggable={
                            can("MANAGE_TASK") &&
                            !activeBoard?.archived &&
                            !projects.find((p) => p.id === projectId)?.archived
                          }
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", t.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                        >
                          <div className="task-tags">
                            {t.tags.map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                            <span className={`priority ${t.priority}`}>
                              {
                                (
                                  {
                                    low: "Basse",
                                    normal: "Normale",
                                    high: "Haute",
                                    urgent: "Urgente",
                                  } as Record<string, string>
                                )[t.priority]
                              }
                            </span>
                          </div>
                          <button
                            className="task-title"
                            onClick={() => setSelected(t)}
                          >
                            {t.title}
                          </button>
                          {t.description && (
                            <p>{t.description.slice(0, 100)}</p>
                          )}
                          <footer>
                            <span>
                              {t.checklist.length > 0 && (
                                <>
                                  <CheckSquare size={13} />
                                  {t.checklist.filter((i) => i.done).length}/
                                  {t.checklist.length}
                                </>
                              )}
                              {t.due_at && (
                                <>
                                  <Calendar size={13} />
                                  {new Date(t.due_at).toLocaleDateString(
                                    "fr-FR",
                                    { day: "numeric", month: "short" },
                                  )}
                                </>
                              )}
                            </span>
                            <span>
                              {members
                                .find((m) => m.id === t.assignee)
                                ?.name.slice(0, 2) || "—"}
                            </span>
                          </footer>
                        </article>
                      ))}
                    </div>
                    {can("CREATE_TASK") && (
                      <button
                        className="add-card"
                        onClick={() =>
                          create(
                            "tasks",
                            "Nouvelle tâche",
                            [{ key: "title", label: "Titre" }],
                            {
                              column_id: c.id,
                              position:
                                Math.max(
                                  -1,
                                  ...tasks
                                    .filter((t) => t.column_id === c.id)
                                    .map((t) => t.position),
                                ) + 1,
                            },
                          )
                        }
                      >
                        <Plus size={16} />
                        Ajouter une carte
                      </button>
                    )}
                  </section>
                );
              })}
            {!activeBoard && (
              <Empty title="Organisez les prochains pas">
                Ajoutez un board à ce projet.
              </Empty>
            )}
          </div>
        </>
      )}
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}{" "}
      {selected && (
        <TaskDetail
          task={selected}
          base={base}
          columns={columns.filter(
            (c) =>
              c.board_id ===
              columns.find((c) => c.id === selected.column_id)?.board_id,
          )}
          members={members}
          canEdit={can("MANAGE_TASK")}
          refresh={refresh}
          fail={fail}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
function TaskDetail({
  task,
  base,
  columns,
  members,
  canEdit,
  refresh,
  fail,
  onClose,
}: {
  task: Row;
  base: string;
  columns: Row[];
  members: Row[];
  canEdit: boolean;
  refresh: () => void;
  fail: (e: unknown) => void;
  onClose: () => void;
}) {
  const [check, setCheck] = useState(""),
    [comments, setComments] = useState<Row[]>([]),
    [comment, setComment] = useState(""),
    [edit, setEdit] = useState(false);
  useEffect(() => {
    api<Result>(`${base}/tasks/${task.id}/comments`)
      .then((r) => setComments(r.data))
      .catch(fail);
  }, [task.id, task.updated_at]);
  const update = (d: unknown) =>
    api(`${base}/tasks/${task.id}`, "PATCH", {
      ...(d as object),
      revision: task.revision,
    })
      .then(refresh)
      .catch(fail);
  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="task-detail">
        <div className="detail-controls">
          <label>
            Colonne
            <select
              value={task.column_id}
              disabled={!canEdit}
              onChange={(e) => void update({ column_id: e.target.value })}
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priorité
            <select
              value={task.priority}
              disabled={!canEdit}
              onChange={(e) => void update({ priority: e.target.value })}
            >
              {["low", "normal", "high", "urgent"].map((p, i) => (
                <option key={p} value={p}>
                  {["Basse", "Normale", "Haute", "Urgente"][i]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsable
            <select
              value={task.assignee || ""}
              disabled={!canEdit}
              onChange={(e) =>
                void update({ assignee: e.target.value || null })
              }
            >
              <option value="">Non attribuée</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Échéance
            <input
              type="date"
              value={task.due_at?.slice(0, 10) || ""}
              disabled={!canEdit}
              onChange={(e) =>
                void update({
                  due_at: e.target.value
                    ? new Date(`${e.target.value}T12:00:00Z`).toISOString()
                    : null,
                })
              }
            />
          </label>
        </div>
        <p className="task-description">
          {task.description || "Aucune description."}
        </p>
        {canEdit && (
          <button onClick={() => setEdit(true)}>
            Modifier le titre et la description
          </button>
        )}
        <h3>Checklist</h3>
        {task.checklist.map((c, i) => (
          <label className="check-row" key={i}>
            <input
              type="checkbox"
              checked={c.done}
              disabled={!canEdit}
              onChange={() =>
                void update({
                  checklist: task.checklist.map((x, j) =>
                    j === i ? { ...x, done: !x.done } : x,
                  ),
                })
              }
            />
            {c.text}
          </label>
        ))}
        {canEdit && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (check.trim())
                void update({
                  checklist: [
                    ...task.checklist,
                    { text: check.trim(), done: false },
                  ],
                }).then(() => setCheck(""));
            }}
          >
            <input
              aria-label="Nouvelle étape"
              placeholder="Ajouter une étape…"
              value={check}
              onChange={(e) => setCheck(e.target.value)}
            />
            <button>
              <Plus size={16} />
            </button>
          </form>
        )}
        <h3>Liens</h3>
        {task.links.map((l) => (
          <p key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          </p>
        ))}
        {canEdit && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = new FormData(f);
              void update({
                links: [
                  ...task.links,
                  { label: String(d.get("label")), url: String(d.get("url")) },
                ],
              }).then(() => f.reset());
            }}
          >
            <input
              name="label"
              aria-label="Libellé du lien"
              placeholder="Libellé"
              required
            />
            <input
              name="url"
              aria-label="URL du lien"
              type="url"
              placeholder="https://…"
              required
            />
            <button>
              <Plus size={16} />
            </button>
          </form>
        )}
        <TaskExtras
          task={task}
          base={base}
          members={members}
          canEdit={canEdit}
          refresh={refresh}
          fail={fail}
        />
        <h3>Commentaires</h3>
        {comments.map((c) => (
          <div className="task-comment" key={c.id}>
            <strong>{c.name}</strong>
            <p>{c.content}</p>
          </div>
        ))}
        {canEdit && (
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              void api(`${base}/tasks/${task.id}/comments`, "POST", {
                content: comment,
              })
                .then(() => api<Result>(`${base}/tasks/${task.id}/comments`))
                .then((r) => {
                  setComments(r.data);
                  setComment("");
                })
                .catch(fail);
            }}
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              aria-label="Commentaire"
              placeholder="Ajouter un commentaire…"
              required
            />
            <button>
              <ArrowRight size={17} />
            </button>
          </form>
        )}
        <small className="muted">
          Créée le {new Date(task.created_at).toLocaleDateString("fr-FR")} ·
          mise à jour le {new Date(task.updated_at).toLocaleString("fr-FR")}
        </small>
      </div>
      {edit && (
        <FormDialog
          title="Modifier la carte"
          fields={[
            { key: "title", label: "Titre", value: task.title },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              value: task.description,
              required: false,
            },
            {
              key: "tags",
              label: "Tags séparés par une virgule",
              value: task.tags.join(", "),
              required: false,
            },
          ]}
          onSave={async (d) => {
            await api(`${base}/tasks/${task.id}`, "PATCH", {
              ...d,
              revision: task.revision,
              tags: d.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            });
            refresh();
          }}
          onClose={() => setEdit(false)}
        />
      )}
    </Modal>
  );
}
