// src/client/Groups.tsx
import { useEffect, useState } from "react";
import { api, collection } from "./api";
import type { Row, Result } from "./types";
export function Groups({
  base,
  fail,
}: {
  base: string;
  fail: (e: unknown) => void;
}) {
  const [groups, setGroups] = useState<Row[]>([]),
    [members, setMembers] = useState<Row[]>([]),
    [selected, setSelected] = useState(""),
    [name, setName] = useState(""),
    [ids, setIds] = useState<string[]>([]),
    [create, setCreate] = useState(""),
    [saved, setSaved] = useState(false);
  const load = () =>
    void Promise.all([
      api<Result>(`${base}/groups`),
      collection(`${base}/members`),
    ])
      .then(([g, m]) => {
        setGroups(g.data);
        setMembers(m.data);
      })
      .catch(fail);
  useEffect(load, [base]);
  return (
    <div className="group-management">
      <p>
        Les groupes réunissent des membres pour donner accès aux salons privés.
        Ils ne modifient pas les rôles administratifs.
      </p>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          void api(`${base}/groups`, "POST", { name: create })
            .then(() => {
              setCreate("");
              load();
            })
            .catch(fail);
        }}
      >
        <input
          aria-label="Nom du groupe"
          placeholder="Nom du nouveau groupe"
          value={create}
          onChange={(e) => setCreate(e.target.value)}
          required
        />
        <button>Créer le groupe</button>
      </form>
      <div className="group-tabs">
        {groups.map((g) => (
          <button
            key={g.id}
            className={selected === g.id ? "active" : ""}
            onClick={() => {
              setSelected(g.id);
              setName(g.name);
              setIds(g.user_ids || []);
              setSaved(false);
            }}
          >
            {g.name} · {g.user_ids?.length || 0}
          </button>
        ))}
      </div>
      {selected && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            void api(`${base}/groups/${selected}`, "PUT", {
              name,
              user_ids: ids,
            })
              .then(() => {
                load();
                setSaved(true);
              })
              .catch(fail);
          }}
        >
          <label>
            Nom
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <fieldset>
            <legend>Membres du groupe</legend>
            {members
              .filter((m) => m.state === "active")
              .map((m) => (
                <label className="check-line" key={m.id}>
                  <input
                    type="checkbox"
                    checked={ids.includes(m.id)}
                    onChange={(e) =>
                      setIds((old) =>
                        e.target.checked
                          ? [...old, m.id]
                          : old.filter((id) => id !== m.id),
                      )
                    }
                  />
                  {m.name}
                </label>
              ))}
          </fieldset>
          <button className="primary">
            {saved ? "Groupe enregistré" : "Enregistrer le groupe"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Supprimer ce groupe et ses accès aux salons ?"))
                void api(`${base}/groups/${selected}`, "DELETE")
                  .then(() => {
                    setSelected("");
                    load();
                  })
                  .catch(fail);
            }}
          >
            Supprimer le groupe
          </button>
        </form>
      )}
    </div>
  );
}
