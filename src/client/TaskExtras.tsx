// src/client/TaskExtras.tsx
import { useEffect, useState } from "react";
import { api, fileData } from "./api";
import type { Row, Result } from "./types";
export function TaskExtras({
  task,
  base,
  members,
  canEdit,
  refresh,
  fail,
}: {
  task: Row;
  base: string;
  members: Row[];
  canEdit: boolean;
  refresh: () => void;
  fail: (e: unknown) => void;
}) {
  const [activity, setActivity] = useState<Row[]>([]),
    [files, setFiles] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let gone = false;
    void Promise.all([
      api<Result>(`${base}/tasks/${task.id}/activity`),
      Promise.all(
        (task.attachment_ids || []).map((id) =>
          api<{ data: Row }>(`${base}/attachments/${id}?metadata=true`).then(
            (r) => r.data,
          ),
        ),
      ),
    ])
      .then(([a, f]) => {
        if (!gone) {
          setActivity(a.data);
          setFiles(f);
        }
      })
      .catch(fail);
    return () => {
      gone = true;
    };
  }, [task.id, task.revision, task.updated_at]);
  const patch = (body: unknown) =>
    api(`${base}/tasks/${task.id}`, "PATCH", {
      ...(body as object),
      revision: task.revision,
    })
      .then(refresh)
      .catch(fail);
  return (
    <>
      <h3>Participants</h3>
      <div className="participants">
        {members
          .filter((m) => m.state === "active")
          .map((m) => (
            <label className="check-line" key={m.id}>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={task.participants?.includes(m.id) || false}
                onChange={(e) =>
                  void patch({
                    participants: e.target.checked
                      ? [...(task.participants || []), m.id]
                      : (task.participants || []).filter((id) => id !== m.id),
                  })
                }
              />
              {m.name}
            </label>
          ))}
      </div>
      <h3>Pièces jointes</h3>
      {files.map((f) => (
        <div className="task-file" key={f.id}>
          <a
            href={`${base}/attachments/${f.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {f.name} · {Math.ceil(f.size / 1000)} Ko
          </a>
          {canEdit && (
            <button
              onClick={() =>
                void patch({
                  attachment_ids: task.attachment_ids?.filter(
                    (id) => id !== f.id,
                  ),
                })
              }
            >
              Détacher
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <label className="file-upload">
          {busy ? "Import en cours…" : "Joindre un fichier · 1 Mo maximum"}
          <input
            type="file"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setBusy(true);
              try {
                const r = await api<{ data: Row }>(
                  `${base}/attachments`,
                  "POST",
                  { name: f.name, data: await fileData(f), task_id: task.id },
                );
                await api(`${base}/tasks/${task.id}`, "PATCH", {
                  attachment_ids: [...(task.attachment_ids || []), r.data.id],
                  revision: task.revision,
                });
                refresh();
              } catch (e) {
                fail(e);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {canEdit && (
        <button
          onClick={() =>
            void api(`${base}/templates`, "POST", {
              name: task.title,
              description: task.description,
              checklist: task.checklist.map((c) => ({ ...c, done: false })),
              tags: task.tags,
              priority: task.priority,
            })
              .then(() => setSaved(true))
              .catch(fail)
          }
        >
          {saved ? "Modèle enregistré" : "Enregistrer comme modèle"}
        </button>
      )}
      <h3>Activité</h3>
      <div className="task-activity">
        {activity.length ? (
          activity.map((a) => (
            <p key={a.id}>
              <strong>{a.author_name || "Service"}</strong> ·{" "}
              {a.action === "created"
                ? "a créé la tâche"
                : a.action === "commented"
                  ? "a ajouté un commentaire"
                  : `a modifié ${(a.detail?.fields || []).map((f) => ({ title: "le titre", description: "la description", column_id: "la colonne", participants: "les participants", attachment_ids: "les fichiers", priority: "la priorité", checklist: "la checklist", assignee: "le responsable", due_at: "l’échéance", tags: "les tags", links: "les liens" })[f] || f).join(", ")}`}
              <small>{new Date(a.created_at).toLocaleString("fr-FR")}</small>
            </p>
          ))
        ) : (
          <p className="muted">
            Les prochaines modifications apparaîtront ici.
          </p>
        )}
      </div>
    </>
  );
}
