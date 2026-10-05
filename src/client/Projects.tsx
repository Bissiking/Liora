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
  Search,
  SlidersHorizontal,
  FolderOpen,
  Pencil,
  X,
} from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
import { Empty, FormDialog, Modal, type Field } from "./ui";
import { Markdown, MarkdownEditor } from "./Markdown";
import { ContextMenu, type MenuState } from "./ContextMenu";
import { useCallback } from "react";
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
  const [menu, setMenu] = useState<MenuState | null>(null),
    [projectQuery, setProjectQuery] = useState(""),
    [dragColumn, setDragColumn] = useState("");
  const closeMenu = useCallback(() => setMenu(null), []);
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
  const archived =
    !!activeBoard?.archived ||
    !!projects.find((p) => p.id === projectId)?.archived;
  function cardMenu(task: Row, trigger: HTMLElement, x: number, y: number) {
    const actions: MenuState["actions"] = [
      { label: "Ouvrir la carte", run: () => setSelected(task) },
      {
        label: "Copier le lien de la carte",
        run: () => {
          const u = new URL(location.href);
          u.hash = new URLSearchParams({
            workspace: base.split("/").at(-1)!,
            view: "projects",
            project: projectId,
            task: task.id,
          }).toString();
          void navigator.clipboard.writeText(u.href).catch(fail);
        },
      },
    ];
    if (!archived && can("MANAGE_TASK"))
      for (const c of columns.filter(
        (c) => c.board_id === activeBoard?.id && c.id !== task.column_id,
      ))
        actions.push({
          label: `Déplacer vers ${c.name}`,
          run: () => void move(task, c.id),
        });
    if (!archived && can("CREATE_TASK"))
      actions.push({
        label: "Dupliquer la carte",
        run: () => {
          void api(`${base}/tasks`, "POST", {
            title: `${task.title} (copie)`.slice(0, 100),
            description: task.description,
            column_id: task.column_id,
            priority: task.priority,
            tags: task.tags,
            checklist: task.checklist.map((c) => ({ ...c, done: false })),
            links: task.links,
            position:
              Math.max(
                0,
                ...tasks
                  .filter((t) => t.column_id === task.column_id)
                  .map((t) => t.position),
              ) + 1,
          })
            .then(refresh)
            .catch(fail);
        },
      });
    if (!archived && can("MANAGE_TASK"))
      actions.push({
        label: "Supprimer la carte",
        danger: true,
        run: () => {
          if (
            confirm(
              `Supprimer « ${task.title} » ? Cette action est définitive.`,
            )
          )
            void api(`${base}/tasks/${task.id}`, "DELETE")
              .then(refresh)
              .catch(fail);
        },
      });
    setMenu({ x, y, trigger, actions, label: `Actions de ${task.title}` });
  }
  function columnMenu(column: Row, trigger: HTMLElement, x: number, y: number) {
    const ordered = columns
        .filter((c) => c.board_id === activeBoard?.id)
        .sort((a, b) => a.position - b.position),
      index = ordered.findIndex((c) => c.id === column.id);
    const actions: MenuState["actions"] = [];
    if (!archived && can("MANAGE_BOARD")) {
      actions.push({
        label: "Renommer la colonne",
        run: () =>
          setForm({
            title: "Renommer la colonne",
            fields: [{ key: "name", label: "Nom", value: column.name }],
            save: async (d) => {
              await api(`${base}/columns/${column.id}`, "PATCH", d);
              refresh();
            },
          }),
      });
      for (const [label, offset] of [
        ["Déplacer à gauche", -1],
        ["Déplacer à droite", 1],
      ] as const)
        actions.push({
          label,
          disabled: !ordered[index + offset],
          run: () => {
            const next = [...ordered];
            [next[index], next[index + offset]] = [
              next[index + offset],
              next[index],
            ];
            void (async () => {
              for (let i = 0; i < next.length; i++)
                await api(`${base}/columns/${next[i].id}`, "PATCH", {
                  position: i,
                });
              refresh();
            })().catch(fail);
          },
        });
      if (can("MANAGE_TASK"))
        actions.push({
          label: "Supprimer la colonne",
          danger: true,
          run: () => {
            if (confirm(`Supprimer « ${column.name} » et ses cartes ?`))
              void api(`${base}/columns/${column.id}`, "DELETE")
                .then(refresh)
                .catch(fail);
          },
        });
    }
    if (actions.length)
      setMenu({ x, y, trigger, actions, label: `Actions de ${column.name}` });
  }
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
      <div className="project-workspace">
        <aside className="project-index" aria-label="Index des projets">
          <label className="project-search">
            <Search size={16} />
            <input
              aria-label="Rechercher un projet"
              placeholder="Trouver un projet…"
              value={projectQuery}
              onChange={(e) => setProjectQuery(e.target.value)}
            />
          </label>
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
              {projectId &&
                projectId !== "unassigned" &&
                can("MANAGE_PROJECT") && (
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
            {boards.some(
              (b) => !b.project_id && (showArchived || !b.archived),
            ) && (
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
            {activeProjects
              .filter((p) =>
                p.name
                  .toLocaleLowerCase("fr")
                  .includes(projectQuery.toLocaleLowerCase("fr")),
              )
              .map((p) => (
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
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {p.archived
                        ? "Archivé"
                        : `${boards.filter((b) => b.project_id === p.id && !b.archived).length} tableaux`}
                    </small>
                  </span>
                </button>
              ))}
          </div>
          {projectQuery &&
            !activeProjects.some((p) =>
              p.name
                .toLocaleLowerCase("fr")
                .includes(projectQuery.toLocaleLowerCase("fr")),
            ) && <p className="muted">Aucun projet trouvé.</p>}
        </aside>
        <div className="project-stage">
          {!activeProjects.length && !boards.some((b) => !b.project_id) ? (
            <Empty title="Votre première idée mérite un projet">
              Créez un projet pour réunir vos tableaux et vos pages.
            </Empty>
          ) : (
            <>
              <div className="project-context">
                <h2>
                  {projects.find((p) => p.id === projectId)?.name ||
                    "Tableaux sans projet"}
                </h2>
                <Markdown
                  text={
                    projects.find((p) => p.id === projectId)?.description ||
                    "Choisissez un tableau pour avancer ensemble."
                  }
                />
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
                        "Nouveau tableau",
                        [{ key: "name", label: "Nom du tableau" }],
                        {
                          project_id:
                            projectId === "unassigned" ? null : projectId,
                        },
                      )
                    }
                  >
                    <Plus size={16} />
                    Tableau
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
                        title: "Réglages du tableau",
                        fields: [
                          {
                            key: "name",
                            label: "Nom",
                            value: activeBoard.name,
                          },
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
                          await api(
                            `${base}/boards/${activeBoard.id}`,
                            "PATCH",
                            {
                              name: d.name,
                              project_id: d.project_id || null,
                              archived: d.archived === "true",
                            },
                          );
                          refresh();
                        },
                      })
                    }
                  >
                    Modifier le tableau
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "Supprimer ce tableau, ses colonnes et ses tâches ?",
                        )
                      )
                        void api(`${base}/boards/${activeBoard.id}`, "DELETE")
                          .then(refresh)
                          .catch(fail);
                    }}
                  >
                    Supprimer le tableau
                  </button>
                </details>
              )}
              <details className="task-filter-panel">
                <summary>
                  <SlidersHorizontal size={16} />
                  Filtres
                  {[priorityFilter, assigneeFilter, dueFilter].filter(Boolean)
                    .length > 0
                    ? ` · ${[priorityFilter, assigneeFilter, dueFilter].filter(Boolean).length} actifs`
                    : ""}
                </summary>
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
                  {(filter ||
                    priorityFilter ||
                    assigneeFilter ||
                    dueFilter) && (
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
              </details>
              <div
                className={`kanban ${layout === "list" ? "task-list-view" : ""}`}
              >
                {columns
                  .filter((c) => c.board_id === activeBoard?.id)
                  .sort((a, b) => a.position - b.position)
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
                        className={`kanban-column ${dragColumn === c.id ? "drop-target" : ""}`}
                        tabIndex={-1}
                        onContextMenu={(e) => {
                          if (
                            can("MANAGE_BOARD") &&
                            !archived &&
                            !(e.target as HTMLElement).closest(".task-card")
                          ) {
                            e.preventDefault();
                            columnMenu(
                              c,
                              e.currentTarget,
                              e.clientX,
                              e.clientY,
                            );
                          }
                        }}
                        onDragOver={(e) => {
                          if (!archived && can("MANAGE_TASK")) {
                            e.preventDefault();
                            setDragColumn(c.id);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          )
                            setDragColumn("");
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragColumn("");
                          const task = tasks.find(
                            (t) =>
                              t.id === e.dataTransfer.getData("text/plain"),
                          );
                          if (task && can("MANAGE_TASK") && !archived)
                            void move(task, c.id);
                        }}
                      >
                        <header>
                          <span
                            className={`column-status status-${index % 3}`}
                          />
                          <h2>{c.name}</h2>
                          <span className="column-count">{cards.length}</span>
                          {can("MANAGE_BOARD") && !archived && (
                            <button
                              className="icon-button"
                              aria-label={`Actions de la colonne ${c.name}`}
                              onClick={(e) => {
                                const r =
                                  e.currentTarget.getBoundingClientRect();
                                columnMenu(
                                  c,
                                  e.currentTarget,
                                  r.left,
                                  r.bottom,
                                );
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>
                          )}
                          {can("CREATE_TASK") && !archived && (
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
                              data-task-id={t.id}
                              tabIndex={0}
                              aria-label={`Carte : ${t.title}`}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                cardMenu(
                                  t,
                                  e.currentTarget,
                                  e.clientX,
                                  e.clientY,
                                );
                              }}
                              onKeyDown={(e) => {
                                if (
                                  e.key === "ContextMenu" ||
                                  (e.shiftKey && e.key === "F10")
                                ) {
                                  e.preventDefault();
                                  const r =
                                    e.currentTarget.getBoundingClientRect();
                                  cardMenu(t, e.currentTarget, r.left, r.top);
                                } else if (
                                  e.key === "Enter" &&
                                  e.target === e.currentTarget
                                )
                                  setSelected(t);
                              }}
                              onDragEnd={() => setDragColumn("")}
                              draggable={
                                can("MANAGE_TASK") &&
                                !activeBoard?.archived &&
                                !projects.find((p) => p.id === projectId)
                                  ?.archived
                              }
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", t.id);
                                e.dataTransfer.effectAllowed = "move";
                              }}
                            >
                              <button
                                className="icon-button card-actions"
                                aria-label={`Actions de la carte ${t.title}`}
                                onClick={(e) => {
                                  const r =
                                    e.currentTarget.getBoundingClientRect();
                                  cardMenu(
                                    t,
                                    e.currentTarget,
                                    r.left,
                                    r.bottom,
                                  );
                                }}
                              >
                                <MoreHorizontal size={16} />
                              </button>
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
                                <Markdown
                                  className="card-excerpt"
                                  text={t.description.slice(0, 160)}
                                />
                              )}
                              <footer>
                                <span>
                                  {t.checklist.length > 0 && (
                                    <>
                                      <CheckSquare size={13} />
                                      {t.checklist.filter((i) => i.done).length}
                                      /{t.checklist.length}
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
                          {!cards.length && (
                            <p className="column-empty">
                              {filter ||
                              priorityFilter ||
                              assigneeFilter ||
                              dueFilter
                                ? "Aucune carte ne correspond aux filtres."
                                : "Aucune carte dans cette colonne."}
                            </p>
                          )}
                        </div>
                        {can("CREATE_TASK") && !archived && (
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
                    Ajoutez un tableau à ce projet.
                  </Empty>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {menu && <ContextMenu menu={menu} close={closeMenu} />}
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
          key={selected.id}
          task={selected}
          base={base}
          columns={columns.filter(
            (c) =>
              c.board_id ===
              columns.find((c) => c.id === selected.column_id)?.board_id,
          )}
          members={members}
          canEdit={can("MANAGE_TASK") && !archived}
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
    [edit, setEdit] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [commentVersion, setCommentVersion] = useState(0),
    [tab, setTab] = useState("content"),
    [title, setTitle] = useState(task.title),
    [description, setDescription] = useState(task.description),
    [tags, setTags] = useState(task.tags.join(", "));
  useEffect(() => {
    let gone = false;
    api<Result>(`${base}/tasks/${task.id}/comments`)
      .then((r) => {
        if (!gone) setComments(r.data);
      })
      .catch((e) => {
        if (!gone) setError(e.message);
      });
    return () => {
      gone = true;
    };
  }, [base, task.id, task.updated_at]);
  async function update(data: object) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      await api(`${base}/tasks/${task.id}`, "PATCH", {
        ...data,
        revision: task.revision,
      });
      refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const done = task.checklist.filter((c) => c.done).length;
  return (
    <Modal
      className="task-dialog"
      title={task.title}
      onClose={() => {
        if (!edit || confirm("Fermer sans enregistrer les modifications ?"))
          onClose();
      }}
    >
      <div className="task-detail task-detail-layout">
        <div className="task-detail-main">
          <nav className="detail-tabs" aria-label="Contenu de la carte">
            {[
              ["content", "Description et étapes"],
              ["comments", `Commentaires (${comments.length})`],
              ["resources", "Fichiers et activité"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {tab === "content" && (
            <>
              <section className="task-section">
                <header>
                  <h3>Description</h3>
                  {canEdit && !edit && (
                    <button
                      onClick={() => {
                        setTitle(task.title);
                        setDescription(task.description);
                        setTags(task.tags.join(", "));
                        setEdit(true);
                      }}
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>
                  )}
                </header>
                {edit ? (
                  <form
                    className="form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await update({
                          title,
                          description,
                          tags: tags
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      )
                        setEdit(false);
                    }}
                  >
                    <label>
                      Titre
                      <input
                        value={title}
                        maxLength={100}
                        required
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </label>
                    <MarkdownEditor
                      key={task.id + ":edit"}
                      label="Description"
                      maxLength={12000}
                      value={description}
                      onChange={setDescription}
                    />
                    <label>
                      Étiquettes · séparées par une virgule
                      <input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                      />
                    </label>
                    <footer>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEdit(false)}
                      >
                        Annuler
                      </button>
                      <button className="primary" disabled={busy}>
                        {busy ? "Enregistrement…" : "Enregistrer"}
                      </button>
                    </footer>
                  </form>
                ) : task.description ? (
                  <Markdown text={task.description} />
                ) : (
                  <p className="muted">
                    Ajoutez du contexte, des liens ou les critères de réussite.
                  </p>
                )}
              </section>
              <section className="task-section">
                <header>
                  <h3>Étapes</h3>
                  <span className="muted">
                    {done} / {task.checklist.length} terminées
                  </span>
                </header>
                {!!task.checklist.length && (
                  <progress
                    aria-label="Progression des étapes"
                    value={done}
                    max={task.checklist.length}
                  />
                )}
                {task.checklist.map((c, i) => (
                  <div className="check-row" key={i}>
                    <label>
                      <input
                        type="checkbox"
                        checked={c.done}
                        disabled={!canEdit || busy}
                        onChange={() =>
                          void update({
                            checklist: task.checklist.map((x, j) =>
                              j === i ? { ...x, done: !x.done } : x,
                            ),
                          })
                        }
                      />
                      <span className={c.done ? "completed-step" : ""}>
                        {c.text}
                      </span>
                    </label>
                    {canEdit && (
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`Retirer l’étape ${c.text}`}
                        onClick={() =>
                          void update({
                            checklist: task.checklist.filter((_, j) => j !== i),
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {!task.checklist.length && (
                  <p className="muted">
                    Découpez cette carte en étapes concrètes.
                  </p>
                )}
                {canEdit && (
                  <form
                    className="inline-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        check.trim() &&
                        (await update({
                          checklist: [
                            ...task.checklist,
                            { text: check.trim(), done: false },
                          ],
                        }))
                      )
                        setCheck("");
                    }}
                  >
                    <input
                      aria-label="Nouvelle étape"
                      placeholder="Ajouter une étape…"
                      value={check}
                      maxLength={300}
                      onChange={(e) => setCheck(e.target.value)}
                    />
                    <button
                      disabled={busy || !check.trim()}
                      aria-label="Ajouter l’étape"
                    >
                      <Plus size={16} />
                    </button>
                  </form>
                )}
              </section>
              <section className="task-section">
                <h3>Liens utiles</h3>
                {task.links.map((l, i) => (
                  <div className="task-link" key={i}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer">
                      <LinkIcon size={15} />
                      {l.label}
                    </a>
                    {canEdit && (
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`Retirer le lien ${l.label}`}
                        onClick={() =>
                          void update({
                            links: task.links.filter((_, j) => j !== i),
                          })
                        }
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {canEdit && (
                  <form
                    className="inline-form task-link-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = e.currentTarget,
                        d = new FormData(f);
                      if (
                        await update({
                          links: [
                            ...task.links,
                            {
                              label: String(d.get("label")),
                              url: String(d.get("url")),
                            },
                          ],
                        })
                      )
                        f.reset();
                    }}
                  >
                    <input
                      name="label"
                      aria-label="Libellé du lien"
                      placeholder="Libellé"
                      maxLength={100}
                      required
                    />
                    <input
                      name="url"
                      aria-label="URL du lien"
                      type="url"
                      placeholder="https://…"
                      required
                    />
                    <button disabled={busy} aria-label="Ajouter le lien">
                      <Plus size={16} />
                    </button>
                  </form>
                )}
                {!task.links.length && !canEdit && (
                  <p className="muted">Aucun lien associé.</p>
                )}
              </section>
            </>
          )}
          {tab === "comments" && (
            <section className="task-section">
              <h3>Discussion</h3>
              {!comments.length && (
                <p className="muted">
                  Partagez une décision ou posez une question sur cette carte.
                </p>
              )}
              {comments.map((c) => (
                <article className="task-comment" key={c.id}>
                  <header>
                    <strong>{c.name}</strong>
                    <time>
                      {new Date(c.created_at).toLocaleString("fr-FR")}
                    </time>
                  </header>
                  <Markdown text={c.content} />
                </article>
              ))}
              {canEdit && (
                <form
                  className="form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (busy) return;
                    setBusy(true);
                    setError("");
                    try {
                      await api(`${base}/tasks/${task.id}/comments`, "POST", {
                        content: comment,
                      });
                      const r = await api<Result>(
                        `${base}/tasks/${task.id}/comments`,
                      );
                      setComments(r.data);
                      setComment("");
                      setCommentVersion((n) => n + 1);
                      refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <MarkdownEditor
                    key={commentVersion}
                    label="Ajouter un commentaire"
                    value={comment}
                    onChange={setComment}
                    maxLength={4000}
                    required
                  />
                  <button
                    className="primary"
                    disabled={busy || !comment.trim()}
                  >
                    {busy ? "Envoi…" : "Envoyer le commentaire"}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </section>
          )}
          {tab === "resources" && (
            <div className="task-section">
              <TaskExtras
                task={task}
                base={base}
                members={members}
                canEdit={canEdit && !busy}
                refresh={refresh}
                fail={fail}
              />
            </div>
          )}
        </div>
        <aside className="task-properties" aria-label="Propriétés de la carte">
          <h3>Propriétés</h3>
          <label>
            Colonne
            <select
              value={task.column_id}
              disabled={!canEdit || busy}
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
              disabled={!canEdit || busy}
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
              disabled={!canEdit || busy}
              onChange={(e) =>
                void update({ assignee: e.target.value || null })
              }
            >
              <option value="">Non attribuée</option>
              {members
                .filter((m) => m.state === "active")
                .map((m) => (
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
              disabled={!canEdit || busy}
              onChange={(e) =>
                void update({
                  due_at: e.target.value
                    ? new Date(`${e.target.value}T12:00:00Z`).toISOString()
                    : null,
                })
              }
            />
          </label>
          {!!task.tags.length && (
            <div className="task-tags">
              {task.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
          {!canEdit && <p className="muted">Carte en lecture seule.</p>}
          <dl className="task-dates">
            <dt>Créée le</dt>
            <dd>{new Date(task.created_at).toLocaleDateString("fr-FR")}</dd>
            <dt>Dernière modification</dt>
            <dd>{new Date(task.updated_at).toLocaleString("fr-FR")}</dd>
          </dl>
          <p role="status" className="muted">
            {busy ? "Enregistrement en cours…" : ""}
          </p>
        </aside>
      </div>
    </Modal>
  );
}
