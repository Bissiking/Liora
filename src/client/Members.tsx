// src/client/Members.tsx
import { useEffect, useState } from "react";
import { UserPlus, ChevronDown, Shield, Trash2 } from "lucide-react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
import { Avatar } from "./ui";

export function Members({
  base,
  can,
  fail,
  refresh,
}: {
  base: string;
  can: (p: string) => boolean;
  fail: (e: unknown) => void;
  refresh: () => void;
}) {
  const [members, setMembers] = useState<Row[]>([]),
    [roles, setRoles] = useState<Row[]>([]),
    [groups, setGroups] = useState<Row[]>([]),
    [editing, setEditing] = useState(""),
    [addOpen, setAddOpen] = useState(false),
    [addKyros, setAddKyros] = useState(""),
    [addRole, setAddRole] = useState(""),
    [editRole, setEditRole] = useState(""),
    [editGroups, setEditGroups] = useState<string[]>([]);

  const load = () =>
    void Promise.all([
      collection(`${base}/members`),
      api<Result>(`${base}/roles`),
      can("MANAGE_MEMBERS")
        ? api<Result>(`${base}/groups`)
        : Promise.resolve({ data: [] as Row[] }),
    ])
      .then(([m, r, g]) => {
        setMembers(m.data);
        setRoles(r.data);
        setGroups(g.data);
        if (!addRole && r.data.length) setAddRole(r.data[0]?.id);
      })
      .catch(fail);

  useEffect(load, [base]);

  const startEdit = (m: Row) => {
    setEditing(m.id);
    setEditRole(m.role_id);
    setEditGroups(m.group_ids || []);
  };

  const saveEdit = (id: string) =>
    void api(`${base}/members/${id}`, "PATCH", {
      role_id: editRole,
    })
      .then(() => {
        setEditing("");
        load();
        refresh();
      })
      .catch(fail);

  const addMember = () =>
    void api(`${base}/members`, "POST", {
      kyros_user_id: addKyros,
      role_id: addRole,
    })
      .then(() => {
        setAddOpen(false);
        setAddKyros("");
        load();
        refresh();
      })
      .catch(fail);

  const removeMember = (id: string, name: string) => {
    if (!confirm(`Retirer ${name} de l'espace ?`)) return;
    void api(`${base}/members/${id}`, "PATCH", { state: "disabled" })
      .then(() => {
        load();
        refresh();
      })
      .catch(fail);
  };

  return (
    <div className="page members-page">
      <header className="page-heading">
        <div>
          <h1>Membres · {members.filter((m) => m.state === "active").length}</h1>
          <p>Gérez les membres et leurs rôles.</p>
        </div>
        {can("MANAGE_MEMBERS") && (
          <button className="primary" onClick={() => setAddOpen(!addOpen)}>
            <UserPlus size={16} />
            Ajouter
          </button>
        )}
      </header>

      {addOpen && can("MANAGE_MEMBERS") && (
        <div className="member-add-form">
          <input
            aria-label="Identifiant Kyros"
            placeholder="Identifiant Kyros du membre"
            value={addKyros}
            onChange={(e) => setAddKyros(e.target.value)}
          />
          <select
            aria-label="Rôle"
            value={addRole}
            onChange={(e) => setAddRole(e.target.value)}
          >
            {roles
              .filter((r) => !r.is_owner)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
          <button className="primary" disabled={!addKyros} onClick={addMember}>
            Ajouter
          </button>
        </div>
      )}

      <div className="members-list">
        {members
          .filter((m) => m.state === "active")
          .map((m) => (
            <article key={m.id} className="member-row">
              <Avatar name={m.name} src={m.avatar} />
              <div className="member-info">
                <strong>{m.name}</strong>
                <span className="member-role">
                  <Shield size={11} />
                  {m.role_name}
                </span>
              </div>
              {editing === m.id ? (
                <div className="member-edit">
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                  >
                    {roles
                      .filter((r) => !r.is_owner)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="primary small"
                    onClick={() => saveEdit(m.id)}
                  >
                    OK
                  </button>
                  <button onClick={() => setEditing("")}>Annuler</button>
                </div>
              ) : (
                <div className="member-actions">
                  {can("MANAGE_MEMBERS") && !m.is_owner && (
                    <button onClick={() => startEdit(m)}>
                      <Shield size={14} />
                    </button>
                  )}
                  {can("MANAGE_MEMBERS") && !m.is_owner && (
                    <button
                      className="icon-button danger"
                      onClick={() => removeMember(m.id, m.name)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </article>
          ))}
      </div>

      {can("MANAGE_MEMBERS") && groups.length > 0 && (
        <section className="members-groups">
          <h2>Groupes</h2>
          <p className="muted">
            Les groupes donnent accès aux salons privés.
          </p>
          <div className="members-groups-list">
            {groups.map((g) => (
              <div key={g.id} className="group-chip">
                <span>{g.name}</span>
                <small>{g.user_ids?.length || 0} membres</small>
              </div>
            ))}
          </div>
          <button onClick={() => can("MANAGE_MEMBERS") && load()}>
            Gérer les groupes
          </button>
        </section>
      )}
    </div>
  );
}
