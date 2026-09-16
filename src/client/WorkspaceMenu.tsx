// src/client/WorkspaceMenu.tsx
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Plus, Users, Settings } from "lucide-react";
import type { Workspace } from "./types";
export function WorkspaceMenu({
  workspace,
  spaces,
  select,
  create,
  admin,
}: {
  workspace: Workspace;
  spaces: Workspace[];
  select: (id: string) => void;
  create: () => void;
  admin: (tab: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };
  return (
    <div className="workspace-menu" ref={root}>
      <button
        className="workspace-title"
        aria-expanded={open}
        aria-controls="workspace-choices"
        onClick={() => setOpen(!open)}
      >
        <span>
          <strong>{workspace.name}</strong>
          <small>L’espace de l’équipe</small>
        </span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div id="workspace-choices" className="workspace-choices">
          <p>Changer d’espace</p>
          {spaces.map((s) => (
            <button key={s.id} onClick={() => run(() => select(s.id))}>
              {s.name}
              {s.id === workspace.id && <Check size={15} />}
            </button>
          ))}
          <hr />
          <button onClick={() => run(create)}>
            <Plus size={16} />
            Créer un espace
          </button>
          {workspace.permissions.includes("MANAGE_MEMBERS") && (
            <button onClick={() => run(() => admin("members"))}>
              <Users size={16} />
              Gérer les membres
            </button>
          )}
          {workspace.permissions.includes("MANAGE_WORKSPACE") && (
            <button onClick={() => run(() => admin("settings"))}>
              <Settings size={16} />
              Paramètres de l’espace
            </button>
          )}
        </div>
      )}
    </div>
  );
}
