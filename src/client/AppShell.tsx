// src/client/AppShell.tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  House,
  MessageSquare,
  Plus,
  LogOut,
  PanelLeft,
  X,
  Search,
  Hash,
  Lock,
  ChevronDown,
  Settings,
  ArrowRight,
} from "lucide-react";
import {
  personalNavigation,
  workspaceNavigation,
  personalViews,
  navigationVisible,
} from "./navigation";
import { Avatar, Modal } from "./ui";
import { EntityMenu } from "./ContextMenuProvider";
import { api } from "./api";
import type { Row, User, Workspace } from "./types";
export function AppShell(p: {
  user: User;
  workspaces: Workspace[];
  workspace?: Workspace;
  view: string;
  channels: Row[];
  categories: Row[];
  channelId: string;
  unread: number;
  can: (permission: string) => boolean;
  navigate: (view: string) => void;
  openChannel: (id: string) => void;
  openWorkspace: (id: string) => void;
  createWorkspace: () => void;
  joinWorkspace: () => void;
  createChannel: () => void;
  createConversation: () => void;
  collapsed: string[];
  collapse: (id: string) => void;
  search: () => void;
  quickSwitch: () => void;
  rename: (kind: string, row: Row) => void;
  settings: (channel: Row) => void;
  refresh: () => void;
  fail: (e: unknown) => void;
  children: ReactNode;
}) {
  const [mobile, setMobile] = useState(false),
    [add, setAdd] = useState(false);
  const sidebar = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement;
    const root = sidebar.current;
    root?.querySelector<HTMLElement>("button,input,select")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        previous?.focus();
      }
      if (e.key === "Tab") {
        const controls = Array.from(
          root?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select,a",
          ) || [],
        );
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mobile]);
  const personal = personalViews.has(p.view) || !p.workspace;
  const nav = personal ? personalNavigation : workspaceNavigation;
  const go = (view: string) => {
    p.navigate(view);
    setMobile(false);
  };
  return (
    <div
      className={`app-shell shell-v1 ${personal ? "scope-personal" : "scope-workspace"}`}
    >
      <a className="skip-link" href="#main">
        Aller au contenu
      </a>
      <nav inert={mobile} className="workspace-rail" aria-label="Espaces">
        <button
          title="Accueil personnel"
          aria-label="Accueil personnel"
          aria-current={personal && p.view !== "friends" ? "page" : undefined}
          onClick={() => go("home")}
        >
          <img src="/brand/icon.svg" alt="" />
        </button>
        <button
          title="Amis et messages privés"
          aria-label="Amis et messages privés"
          onClick={() => go("messages")}
        >
          <MessageSquare size={22} />
        </button>
        <div className="rail-divider" />
        <div className="rail-workspaces">
          {p.workspaces.map((w) => (
            <EntityMenu
              key={w.id}
              label={`Workspace ${w.name}`}
              showButton={false}
              actions={[
                {
                  label: "Ouvrir le workspace",
                  run: () => {
                    p.openWorkspace(w.id);
                    setMobile(false);
                  },
                },
                {
                  label: "Copier l’ID",
                  run: () =>
                    void navigator.clipboard.writeText(w.id).catch(p.fail),
                },
                ...(w.permissions.includes("MANAGE_WORKSPACE")
                  ? [
                      {
                        label: "Paramètres du workspace",
                        run: () => {
                          p.openWorkspace(w.id);
                          go("admin");
                        },
                      },
                    ]
                  : []),
              ]}
            >
              <button
                title={w.name}
                aria-label={`Espace ${w.name}`}
                aria-current={
                  !personal && p.workspace?.id === w.id ? "page" : undefined
                }
                onClick={() => {
                  p.openWorkspace(w.id);
                  setMobile(false);
                }}
              >
                <span>{w.name.slice(0, 2).toUpperCase()}</span>
              </button>
            </EntityMenu>
          ))}
        </div>
        <button
          aria-label="Ajouter ou rejoindre un espace"
          title="Ajouter ou rejoindre un espace"
          onClick={() => setAdd(true)}
        >
          <Plus size={22} />
        </button>
        <button
          className="rail-settings"
          aria-label="Paramètres personnels"
          title="Paramètres personnels"
          onClick={() => go("settings")}
        >
          <Settings size={21} />
        </button>
      </nav>
      {mobile && (
        <button
          className="shell-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        ref={sidebar}
        role={mobile ? "dialog" : undefined}
        aria-modal={mobile || undefined}
        className={`shell-sidebar ${mobile ? "open" : ""}`}
        aria-label={
          personal ? "Navigation personnelle" : "Navigation du workspace"
        }
      >
        <header>
          <div>
            <strong>{personal ? "Mon espace" : p.workspace?.name}</strong>
            <small>{personal ? "Personnel" : "Workspace"}</small>
          </div>
          <button
            className="icon-button shell-close"
            aria-label="Fermer la navigation"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </header>
        <button className="shell-switch" onClick={p.quickSwitch}>
          <Search size={16} />
          Aller à…<kbd>⌘ K</kbd>
        </button>
        <nav
          aria-label={
            personal ? "Mon espace personnel" : "Modules du workspace"
          }
        >
          {nav
            .filter((n) => navigationVisible(n, p.can) && n.id !== "chat")
            .map((n) => (
              <button
                key={n.id}
                className={p.view === n.id ? "active" : ""}
                aria-current={p.view === n.id ? "page" : undefined}
                onClick={() => go(n.id)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {n.id === "notifications" && p.unread > 0 && (
                  <b className="mention-badge">{p.unread}</b>
                )}
              </button>
            ))}
        </nav>
        {!personal && (
          <div className="shell-channels">
            <div className="shell-section-heading">
              <strong>Canaux</strong>
              {p.can("CREATE_CHANNEL") && (
                <button
                  className="icon-button"
                  aria-label="Créer un salon"
                  onClick={p.createChannel}
                >
                  <Plus size={17} />
                </button>
              )}
            </div>
            {[...p.categories, { id: "", name: "Sans catégorie" }].map(
              (cat) => {
                const rows = p.channels.filter(
                  (c) => !c.archived && (c.category_id || "") === cat.id,
                );
                if (!rows.length) return null;
                const key = `channel:${p.workspace?.id}:${cat.id || "uncategorized"}`,
                  collapsed = p.collapsed.includes(key);
                return (
                  <EntityMenu
                    className="shell-channel-group"
                    key={cat.id}
                    label={`Catégorie ${cat.name}`}
                    actions={[
                      {
                        label: collapsed ? "Déplier" : "Replier",
                        run: () => p.collapse(key),
                      },
                      ...(cat.id && p.can("MANAGE_CHANNEL")
                        ? [
                            {
                              label: "Renommer",
                              run: () => p.rename("categories", cat as Row),
                            },
                          ]
                        : []),
                    ]}
                  >
                    <button
                      className="shell-category"
                      aria-expanded={!collapsed}
                      onClick={() => p.collapse(key)}
                    >
                      <ChevronDown
                        size={15}
                        className={collapsed ? "folded" : ""}
                      />
                      {cat.name}
                    </button>
                    {!collapsed &&
                      rows.map((c) => (
                        <EntityMenu
                          key={c.id}
                          label={`Canal ${c.name}`}
                          actions={[
                            {
                              label: "Ouvrir le canal",
                              run: () => {
                                p.openChannel(c.id);
                                setMobile(false);
                              },
                            },
                            {
                              label: "Copier l’ID",
                              run: () =>
                                void navigator.clipboard
                                  .writeText(c.id)
                                  .catch(p.fail),
                            },
                            ...(!c.is_dm &&
                            (c.capabilities?.includes("MANAGE_CHANNEL") ||
                              (!c.capabilities && p.can("MANAGE_CHANNEL")))
                              ? [
                                  {
                                    label: "Paramètres du canal",
                                    run: () => p.settings(c),
                                  },
                                ]
                              : []),
                            ...(!c.is_dm &&
                            (c.capabilities?.includes("DELETE_CHANNEL") ||
                              (!c.capabilities && p.can("DELETE_CHANNEL")))
                              ? [
                                  {
                                    label: "Archiver",
                                    danger: true,
                                    run: () => {
                                      if (
                                        confirm(
                                          `Archiver ${c.name} ? L’historique sera conservé.`,
                                        )
                                      )
                                        void api(
                                          `/api/v1/workspaces/${p.workspace?.id}/channels/${c.id}`,
                                          "DELETE",
                                        )
                                          .then(p.refresh)
                                          .catch(p.fail);
                                    },
                                  },
                                ]
                              : []),
                          ]}
                        >
                          <button
                            className={`shell-channel ${p.channelId === c.id && p.view === "chat" ? "active" : ""} ${c.unread_count ? "unread" : ""}`}
                            aria-current={
                              p.channelId === c.id && p.view === "chat"
                                ? "page"
                                : undefined
                            }
                            onClick={() => {
                              p.openChannel(c.id);
                              setMobile(false);
                            }}
                          >
                            {c.is_private ? (
                              <Lock size={17} />
                            ) : (
                              <Hash size={17} />
                            )}
                            <span>{c.name}</span>
                            {!!c.mention_count && (
                              <b className="mention-badge">{c.mention_count}</b>
                            )}
                            {!!c.unread_count && !c.mention_count && (
                              <span
                                className="unread-dot"
                                aria-label={`${c.unread_count} messages non lus`}
                              />
                            )}
                          </button>
                        </EntityMenu>
                      ))}
                  </EntityMenu>
                );
              },
            )}
            {p.can("SEND_MESSAGE") && (
              <button className="shell-private" onClick={p.createConversation}>
                <Plus size={16} />
                Conversation privée
              </button>
            )}
          </div>
        )}
        <footer>
          <button onClick={() => go("settings")}>
            <Avatar name={p.user.name} src={p.user.avatar} />
            <span>
              <strong>{p.user.name}</strong>
              <small>Paramètres personnels</small>
            </span>
          </button>
          <button
            className="icon-button"
            aria-label="Se déconnecter"
            onClick={() =>
              void api("/auth/logout", "POST").then(() => location.reload())
            }
          >
            <LogOut size={18} />
          </button>
        </footer>
      </aside>
      <div className="shell-body" inert={mobile}>
        <header className="shell-topbar">
          <button
            className="icon-button"
            ref={trigger}
            aria-label="Ouvrir la navigation"
            aria-expanded={mobile}
            onClick={() => setMobile(true)}
          >
            <PanelLeft size={20} />
          </button>
          <span>
            {personal ? "Personnel" : p.workspace?.name}
            <span className="shell-location">
              {" "}
              /{" "}
              {p.view === "chat"
                ? p.channels.find((c) => c.id === p.channelId)?.name
                : nav.find((n) => n.id === p.view)?.label || "Liora"}
            </span>
          </span>
          {!personal && p.can("VIEW_CHANNEL") && (
            <button
              className="icon-button"
              aria-label="Rechercher dans les conversations"
              onClick={p.search}
            >
              <Search size={20} />
            </button>
          )}
        </header>
        <main id="main" tabIndex={-1} className={`content content-${p.view}`}>
          {p.children}
        </main>
      </div>
      <nav className="shell-mobile-dock" aria-label="Navigation mobile">
        <button
          onClick={() => go("home")}
          aria-current={p.view === "home" ? "page" : undefined}
        >
          <House size={20} />
          Personnel
        </button>
        <button onClick={() => go("friends")}>
          <MessageSquare size={20} />
          Amis
        </button>
        <button onClick={() => setMobile(true)}>
          <PanelLeft size={20} />
          Navigation
        </button>
      </nav>
      {add && (
        <Modal title="Votre prochain espace" onClose={() => setAdd(false)}>
          <p>
            Créez un workspace ou rejoignez une équipe avec son lien
            d’invitation.
          </p>
          <div className="dialog-actions">
            <button
              onClick={() => {
                setAdd(false);
                p.joinWorkspace();
              }}
            >
              Rejoindre
              <ArrowRight size={18} />
            </button>
            <button
              className="primary"
              onClick={() => {
                setAdd(false);
                p.createWorkspace();
              }}
            >
              <Plus size={18} />
              Créer un espace
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
