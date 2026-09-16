// src/client/main.tsx
import { VERSION } from "../shared/version";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Hash,
  Lock,
  ChevronDown,
  Plus,
  MessageSquare,
  LayoutGrid,
  FileText,
  Activity,
  Bell,
  Settings,
  PanelLeft,
  ArrowRight,
  LogOut,
  Search,
  Command,
  Users,
  ArrowUpRight,
  Star,
  Calendar as CalendarIcon,
  UserPlus,
  Shield,
} from "lucide-react";
import "@fontsource-variable/manrope";
import "./styles.css";
import { api, ApiError, collection } from "./api";
import type { Row, Result, User, Workspace } from "./types";
import { Avatar, Empty, FormDialog, type Field } from "./ui";
import { Chat } from "./Chat";
import { Projects } from "./Projects";
import { Pages } from "./Pages";
import { Admin } from "./Admin";
import { Preferences } from "./Preferences";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { RenderBoundary } from "./RenderBoundary";
import { Monitoring } from "./Monitoring";
import { SearchMessages } from "./Collaboration";
import { Friends, Invitation } from "./Social";
import { Help } from "./Help";
import { Calendar } from "./Calendar";
import { Reminders } from "./Reminders";
import { Favorites } from "./Favorites";
import { Groups } from "./Groups";
import { Members } from "./Members";
import { playSound } from "./sound";
function App() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);
  const [invite, setInvite] = useState(() => {
    const token = new URLSearchParams(location.hash.slice(1)).get("invite");
    if (token) sessionStorage.setItem("liora.invite", token);
    return token || sessionStorage.getItem("liora.invite") || "";
  });
  useEffect(() => {
    const receive = () => {
      const token = new URLSearchParams(location.hash.slice(1)).get("invite");
      if (token) {
        sessionStorage.setItem("liora.invite", token);
        setInvite(token);
      }
    };
    window.addEventListener("hashchange", receive);
    return () => window.removeEventListener("hashchange", receive);
  }, []);
  const [targetMessage, setTargetMessage] = useState("");
  const seenNotifications = useRef<Set<string> | null>(null);
  const [searchMessages, setSearchMessages] = useState(false);
  const [me, setMe] = useState<User | null>(null),
    [spaces, setSpaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(""),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [view, setView] = useState(
      () => sessionStorage.getItem("liora.view") || "chat",
    ),
    [adminTab, setAdminTab] = useState(
      () => sessionStorage.getItem("liora.adminTab") || "overview",
    ),
    [channels, setChannels] = useState<Row[]>([]),
    [categories, setCategories] = useState<Row[]>([]),
    [channelId, setChannelId] = useState(
      () => sessionStorage.getItem("liora.channel") || "",
    ),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(""),
    [revision, setRevision] = useState(0),
    [connection, setConnection] = useState("Connexion…"),
    [presence, setPresence] = useState<Row[]>([]),
    [notifications, setNotifications] = useState<Row[]>([]),
    [form, setForm] = useState<{
      title: string;
      fields: Field[];
      save: (data: Record<string, string>) => Promise<void>;
    } | null>(null);
  const workspace = spaces.find((w) => w.id === workspaceId),
    base = `/api/v1/workspaces/${workspaceId}`,
    can = (p: string) => workspace?.permissions.includes(p) || false;
  const refresh = () => setRevision((n) => n + 1);
  const fail = (e: unknown) =>
    setError(e instanceof Error ? e.message : "Connexion interrompue.");
  const loadMe = useCallback(async () => {
    try {
      const r = await api<{ data: User; workspaces: Workspace[] }>(
        "/api/v1/me",
      );
      setMe(r.data);
      setSpaces(r.workspaces);
      setWorkspaceId((old) =>
        r.workspaces.some((w) => w.id === old)
          ? old
          : r.workspaces[0]?.id || "",
      );
      setStatus("ready");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setStatus("login");
      else {
        fail(e);
        setStatus((old) => (old === "ready" ? "ready" : "error"));
      }
    }
  }, []);
  useEffect(() => {
    void loadMe();
  }, [loadMe]);
  useEffect(() => {
    if (channelId) sessionStorage.setItem("liora.channel", channelId);
  }, [channelId]);
  useEffect(() => {
    sessionStorage.setItem("liora.view", view);
  }, [view]);
  useEffect(() => {
    sessionStorage.setItem("liora.adminTab", adminTab);
  }, [adminTab]);
  useEffect(() => {
    if (!me) return;
    const prefs = me.preferences;
    document.documentElement.dataset.theme = String(prefs.theme || "dark");
    document.documentElement.dataset.density = String(
      prefs.density || "comfortable",
    );
    document.documentElement.dataset.fontSize = String(
      prefs.fontSize || "normal",
    );
  }, [me]);
  useEffect(() => {
    if (!me) return;
    let running = false;
    const renew = async () => {
      if (running || !navigator.onLine) return;
      running = true;
      try {
        await api("/auth/refresh", "POST");
        await loadMe();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setStatus("login");
      } finally {
        running = false;
      }
    };
    const visible = () => {
      if (document.visibilityState === "visible") void renew();
    };
    const timer = setInterval(renew, 60000);
    window.addEventListener("online", renew);
    window.addEventListener("pageshow", renew);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", renew);
      window.removeEventListener("pageshow", renew);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [me]);
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    Promise.all([
      can("VIEW_CHANNEL") ? collection(`${base}/channels`) : { data: [] },
      can("VIEW_CHANNEL") ? collection(`${base}/categories`) : { data: [] },
      api<Result>(`${base}/notifications`),
      api<Result>(`${base}/presence`),
    ])
      .then(([c, g, n, p]) => {
        if (cancelled) return;
        setChannels(c.data);
        setCategories(g.data);
        setNotifications(n.data);
        if (seenNotifications.current) {
          const fresh = n.data.find(
            (n) =>
              n.state === "unread" && !seenNotifications.current!.has(n.id),
          );
          if (fresh) {
            const kind =
              fresh.type === "argos"
                ? "critical"
                : fresh.type === "mention"
                  ? "mention"
                  : "message";
            const pref =
              kind === "critical"
                ? "soundCritical"
                : kind === "mention"
                  ? "soundMentions"
                  : "soundMessages";
            if (me?.preferences[pref])
              void playSound(
                kind,
                String(me.preferences.soundVolume || "low"),
              ).catch(() => {});
          }
        }
        seenNotifications.current = new Set(n.data.map((n) => n.id));
        setPresence(p.data);
        setChannelId((old) =>
          c.data.some((ch) => ch.id === old)
            ? old
            : c.data.find((ch) => !ch.archived)?.id || "",
        );
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [workspaceId, revision, workspace?.permissions.join(",")]);
  useEffect(() => {
    if (!workspaceId) return;
    const stream = new EventSource(`${base}/stream`);
    stream.onopen = () => {
      setConnection("En direct");
      refresh();
    };
    stream.onmessage = (event) => {
      refresh();
      if (JSON.parse(event.data).type === "access.updated") void loadMe();
    };
    stream.onerror = () => setConnection("Reconnexion…");
    return () => stream.close();
  }, [workspaceId]);
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "k") {
        e.preventDefault();
        setMobile(true);
        document.getElementById("channel-search")?.focus();
      }
      if (e.key === "Escape") setMobile(false);
      if (mod && e.key === "1") { e.preventDefault(); navigate("chat"); }
      if (mod && e.key === "2") { e.preventDefault(); navigate("projects"); }
      if (mod && e.key === "3") { e.preventDefault(); navigate("calendar"); }
      if (mod && e.key === "4") { e.preventDefault(); navigate("reminders"); }
      if (mod && e.key === "5") { e.preventDefault(); navigate("favorites"); }
      if (mod && e.key === "6") { e.preventDefault(); navigate("notifications"); }
      if (mod && e.key === "7") { e.preventDefault(); navigate("pages"); }
      if (mod && e.key === ",") { e.preventDefault(); navigate("settings"); }
      if (mod && e.key === "/") { e.preventDefault(); navigate("help"); }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);
  useEffect(() => {
    if (
      workspace &&
      view === "monitoring" &&
      !workspace.permissions.includes("VIEW_MONITORING")
    )
      setView("chat");
  }, [workspace, view]);
  useEffect(() => {
    if (location.hash.startsWith("#connected=dropit")) {
      const linkedWorkspace = new URLSearchParams(location.hash.slice(1)).get(
        "workspace",
      );
      if (linkedWorkspace) setWorkspaceId(linkedWorkspace);
      setView("settings");
    }
  }, []);
  const navigate = (v: string) => {
    setView(v);
    setMobile(false);
  };
  const createChannel = () =>
    setForm({
      title: "Créer un salon",
      fields: [
        { key: "name", label: "Nom du salon" },
        { key: "description", label: "Description", required: false },
        {
          key: "is_private",
          label: "Visibilité",
          options: [
            { value: "false", label: "Tous les membres" },
            { value: "true", label: "Privé · accès sur invitation" },
          ],
        },
        {
          key: "category_id",
          label: "Catégorie",
          required: false,
          options: [
            { value: "", label: "Sans catégorie" },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ],
        },
        {
          key: "type",
          label: "Type",
          options: [
            { value: "text", label: "Discussion" },
            { value: "announcement", label: "Annonces" },
            { value: "project", label: "Projet" },
            ...(can("MANAGE_MONITORING")
              ? [{ value: "monitoring", label: "Monitoring" }]
              : []),
          ],
        },
      ],
      save: async (d) => {
        const r = await api<{ data: Row }>(`${base}/channels`, "POST", {
          ...d,
          category_id: d.category_id || null,
          is_private: d.is_private === "true",
        });
        refresh();
        setChannelId(r.data.id);
        navigate("chat");
      },
    });
  if (status === "loading")
    return (
      <div className="loading">
        <img src="/brand/icon.svg" alt="" />
        <p>Ouverture de Liora…</p>
      </div>
    );
  if (status === "login" || status === "error")
    return (
      <div className="login">
        <div className="login-brand">
          <img src="/brand/logo-dark.svg" alt="Liora" />
          <span>Un espace LUMA</span>
        </div>
        <main>
          <div className="login-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <i />
          </div>
          <h1>
            Les bonnes idées
            <br />
            se construisent
            <br />
            <em>ensemble.</em>
          </h1>
          <p>
            Conversations, projets et signaux de votre écosystème.
            <br />
            Un seul endroit pour leur donner une suite.
          </p>
          <a className="primary" href="/auth/login">
            Entrer avec Kyros
            <ArrowRight size={18} />
          </a>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>Votre identité Kyros. Les permissions de votre équipe.</small>
        </main>
        <footer>
          <span>Liora {VERSION} · BETA</span>
          <span>Communication. Organisation. Connexion.</span>
        </footer>
      </div>
    );
  if (invite && me)
    return (
      <Invitation
        token={invite}
        done={async () => {
          sessionStorage.removeItem("liora.invite");

          setInvite("");
          await loadMe();
        }}
      />
    );
  if (!workspace)
    return (
      <div className="waiting">
        <div className="waiting-header">
          <img src="/brand/logo-dark.svg" alt="Liora" />
          <h1>Bienvenue, {me?.name}.</h1>
          <p>
            Connectez-vous avec votre équipe. Créez un espace ou acceptez une
            invitation pour commencer.
          </p>
        </div>

        <div className="waiting-cards">
          <section className="waiting-card">
            <h2>Accepter une invitation</h2>
            <p>Vous avez reçu un lien d'amis ? Collez-le ici pour accepter.</p>
            <div className="waiting-join">
              <input
                aria-label="Lien d'invitation"
                placeholder="Lien d'invitation"
                id="join-input"
              />
              <button
                className="primary"
                onClick={() => {
                  const input = document.getElementById(
                    "join-input",
                  ) as HTMLInputElement;
                  const val = input?.value?.trim();
                  if (!val) return;
                  let token = val;
                  if (val.includes("#invite=")) {
                    token = val.split("#invite=")[1] || "";
                  } else if (val.includes("/invite/")) {
                    token = val.split("/invite/")[1] || "";
                  }
                  if (token) {
                    location.hash = `invite=${token}`;
                    location.reload();
                  }
                }}
              >
                Accepter
              </button>
            </div>
          </section>

          <section className="waiting-card">
            <h2>Créer un espace</h2>
            <p>
              Invitez vos amis et commencez à discuter dans votre propre espace.
            </p>
            <button
              onClick={() =>
                setForm({
                  title: "Nouvel espace",
                  fields: [{ key: "name", label: "Nom de l'espace" }],
                  save: async (d) => {
                    await api("/api/v1/workspaces", "POST", d);
                    await loadMe();
                  },
                })
              }
            >
              Créer mon espace
            </button>
          </section>
        </div>

        <section className="waiting-account">
          <h2>Votre identifiant</h2>
          <p>
            Partagez cet identifiant avec quelqu'un pour qu'il puisse vous
            envoyer une demande d'amis.
          </p>
          <code className="waiting-kyros">{me?.kyros_user_id}</code>
          <div className="waiting-actions">
            <button onClick={() => void loadMe()}>Actualiser</button>
            <button
              onClick={() =>
                void api("/auth/logout", "POST").then(() => location.reload())
              }
            >
              Se déconnecter
            </button>
          </div>
        </section>

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
  const channel = channels.find(
      (c) =>
        c.id === channelId &&
        (c.type !== "monitoring" || can("VIEW_MONITORING")),
    ),
    unread = notifications.filter((n) => n.state === "unread").length;
  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Aller au contenu
      </a>
      <nav className="space-rail" aria-label="Espaces">
        <img className="brand-icon" src="/brand/icon.svg" alt="Liora" />
        <div className="rail-divider" />
        {can("SEND_MESSAGE") && (
          <button
            className="space-button dm-button"
            title="Conversation privée"
            aria-label="Nouvelle conversation privée"
            onClick={() =>
              void collection(`${base}/members`)
                .then((r) =>
                  setForm({
                    title: "Nouvelle conversation privée",
                    fields: [
                      {
                        key: "user_id",
                        label: "Membre",
                        options: r.data
                          .filter((m) => m.id !== me?.id)
                          .map((m) => ({ value: m.id, label: m.name })),
                      },
                    ],
                    save: async (d) => {
                      const r = await api<{ data: Row }>(
                        `${base}/conversations`,
                        "POST",
                        d,
                      );
                      refresh();
                      setChannelId(r.data.id);
                      navigate("chat");
                    },
                  }),
                )
                .catch(fail)
            }
          >
            <MessageSquare size={20} />
          </button>
        )}
        <div className="rail-divider" />
        {spaces.map((w) => (
          <button
            key={w.id}
            className={`space-button ${workspaceId === w.id ? "active" : ""}`}
            title={w.name}
            aria-label={`Espace ${w.name}`}
            onClick={() => {
              setWorkspaceId(w.id);
              setChannelId("");
              setView("chat");
            }}
          >
            {w.name.slice(0, 1)}
          </button>
        ))}
        <button
          className="space-add"
          aria-label="Créer un espace"
          onClick={() =>
            setForm({
              title: "Créer un espace",
              fields: [{ key: "name", label: "Nom de l'espace" }],
              save: async (d) => {
                await api("/api/v1/workspaces", "POST", d);
                await loadMe();
              },
            })
          }
        >
          <Plus />
        </button>
        <span className="rail-bottom">LUMA</span>
      </nav>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setMobile(false)}
        />
      )}
      {searchMessages && (
        <SearchMessages
          base={base}
          close={() => setSearchMessages(false)}
          open={(id, message) => {
            setTargetMessage(message);
            setChannelId(id);
            navigate("chat");
          }}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <WorkspaceMenu
          workspace={workspace}
          spaces={spaces}
          select={(id) => {
            setWorkspaceId(id);
            setChannelId("");
            setView("chat");
            setMobile(false);
          }}
          create={() =>
            setForm({
              title: "Créer un espace",
              fields: [{ key: "name", label: "Nom de l'espace" }],
              save: async (d) => {
                const r = await api<{ data: Workspace }>(
                  "/api/v1/workspaces",
                  "POST",
                  d,
                );
                await loadMe();
                setWorkspaceId(r.data.id);
                setView("chat");
              },
            })
          }
          admin={(tab) => {
            setAdminTab(tab);
            navigate("admin");
          }}
        />
        <nav className="main-nav" aria-label="Navigation principale">
          <button
            className={view === "friends" ? "active" : ""}
            onClick={() => navigate("friends")}
          >
            <Users size={18} />
            Amis
          </button>
          <button
            className={view === "notifications" ? "active" : ""}
            onClick={() => navigate("notifications")}
          >
            <Bell />
            Boîte de réception
            {unread > 0 && <span className="count">{unread}</span>}
          </button>
          {can("VIEW_PROJECT") && (
            <button
              className={view === "projects" ? "active" : ""}
              onClick={() => navigate("projects")}
            >
              <LayoutGrid />
              Projets
            </button>
          )}
          {can("VIEW_PAGES") && (
            <button
              className={view === "pages" ? "active" : ""}
              onClick={() => navigate("pages")}
            >
              <FileText />
              Pages de l'équipe
            </button>
          )}
          {can("VIEW_MONITORING") && (
            <button
              className={view === "monitoring" ? "active" : ""}
              onClick={() => navigate("monitoring")}
            >
              <Activity />
              Supervision
              <span className="tiny-dot" />
            </button>
          )}
          {can("MANAGE_MEMBERS") && (
            <button
              className={view === "members" ? "active" : ""}
              onClick={() => navigate("members")}
            >
              <Users size={18} />
              Membres
            </button>
          )}
        </nav>
        <nav className="secondary-nav" aria-label="Outils">
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => navigate("calendar")}
            title="Calendrier"
          >
            <CalendarIcon size={16} />
            <span>Calendrier</span>
          </button>
          <button
            className={view === "reminders" ? "active" : ""}
            onClick={() => navigate("reminders")}
            title="Rappels"
          >
            <Bell size={16} />
            <span>Rappels</span>
          </button>
          <button
            className={view === "favorites" ? "active" : ""}
            onClick={() => navigate("favorites")}
            title="Favoris"
          >
            <Star size={16} />
            <span>Favoris</span>
          </button>
          <button
            className={view === "help" ? "active" : ""}
            onClick={() => navigate("help")}
            title="Aide"
          >
            <FileText size={16} />
            <span>Aide</span>
          </button>
        </nav>
        <div className="channel-index">
          <div className="channel-filter">
            <Search size={13} />
            <input
              id="channel-search"
              aria-label="Filtrer les salons"
              placeholder="Filtrer"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="section-label">
            <span>Salons de l’espace</span>
            {can("CREATE_CHANNEL") && (
              <button
                className="icon-button"
                aria-label="Créer un salon"
                onClick={createChannel}
              >
                <Plus size={15} />
              </button>
            )}
          </div>
          {[...categories, { id: "", name: "SANS CATÉGORIE" } as Row].map(
            (cat) => {
              const items = channels.filter(
                (c) =>
                  (c.type !== "monitoring" || can("VIEW_MONITORING")) &&
                  !c.archived &&
                  (c.category_id || "") === cat.id &&
                  c.name.toLowerCase().includes(query.toLowerCase()),
              );
              return items.length ? (
                <section className="channel-group" key={cat.id}>
                  <h3>
                    <ChevronDown size={12} />
                    {cat.name}
                  </h3>
                  {items.map((c) => (
                    <button
                      key={c.id}
                      className={
                        view === "chat" && channelId === c.id ? "active" : ""
                      }
                      onClick={() => {
                        setChannelId(c.id);
                        navigate("chat");
                      }}
                    >
                      {c.is_private ? (
                        <Lock size={16} />
                      ) : c.type === "monitoring" ? (
                        <Activity size={17} />
                      ) : (
                        <Hash size={17} />
                      )}
                      <span>{c.name}</span>
                      {view === "chat" && channelId === c.id && (
                        <span className="active-dot" />
                      )}
                    </button>
                  ))}
                </section>
              ) : null;
            },
          )}
          {!channels.length && (
            <p className="muted padded">Créez votre premier salon.</p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="version-note">
            <img src="/brand/icon.svg" alt="" />
            <span>
              Liora <small>{VERSION} · BETA</small>
            </span>
            <button
              className="icon-button"
              aria-label="À propos de Liora"
              onClick={() => navigate("about")}
            >
              <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            className="profile-button"
            onClick={() => navigate("settings")}
          >
            <Avatar src={me!.avatar} name={me!.name} small />
            <span>
              <strong>{me!.name}</strong>
              <small>{workspace.role_name}</small>
            </span>
            <Settings size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-button menu-toggle"
            aria-label="Ouvrir la navigation"
            onClick={() => setMobile(!mobile)}
          >
            <PanelLeft />
          </button>
          <div className="breadcrumb">
            <span>{workspace.name}</span>
            <span>/</span>
            <strong>
              {view === "chat"
                ? channel?.name || "Conversations"
                : (
                    {
                      friends: "Amis",
                      help: "Aide et tutoriels",
                      projects: "Projets",
                      calendar: "Calendrier",
                      reminders: "Rappels",
                      favorites: "Favoris",
                      pages: "Pages de l'équipe",
                      monitoring: "Supervision",
                      members: "Membres",
                      notifications: "Boîte de réception",
                      admin: "Administration",
                      settings: "Préférences",
                      about: "À propos",
                    } as Record<string, string>
                  )[view]}
            </strong>
          </div>
          <div className="topbar-right">
            <button
              className="icon-button topbar-search"
              aria-label="Rechercher des messages"
              onClick={() => setSearchMessages(true)}
            >
              <Search size={16} />
            </button>
            <span
              className={`connection ${connection === "En direct" ? "online" : ""}`}
            >
              <i />
              {connection}
            </span>
            <span className="divider" />
            <Users size={16} />
            <span>{presence.length}</span>
            <Avatar src={me!.avatar} name={me!.name} small />
          </div>
        </header>
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button onClick={() => setError("")}>Fermer</button>
          </div>
        )}
        <main id="main" className={`content content-${view}`}>
          <RenderBoundary key={`${workspaceId}/${view}`}>
            {view === "chat" &&
              (channel ? (
                <Chat
                  key={`${base}/${channel.id}`}
                  base={base}
                  channel={channel}
                  targetMessage={targetMessage}
                  clearTarget={() => setTargetMessage("")}
                  user={me!}
                  can={can}
                  revision={revision}
                  refresh={refresh}
                  fail={fail}
                  presence={presence}
                />
              ) : (
                <Empty
                  title="Un espace pour les conversations"
                  action={
                    can("CREATE_CHANNEL") ? (
                      <button className="primary" onClick={createChannel}>
                        Créer un salon
                      </button>
                    ) : undefined
                  }
                >
                  Les salons de votre équipe apparaîtront ici.
                </Empty>
              ))}
            {view === "projects" && (
              <Projects
                base={base}
                can={can}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "pages" && (
              <Pages
                base={base}
                can={can}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "calendar" && (
              <Calendar
                base={base}
                can={can}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "reminders" && (
              <Reminders
                base={base}
                revision={revision}
                refresh={refresh}
                fail={fail}
              />
            )}
            {view === "favorites" && (
              <Favorites
                base={base}
                onNavigate={(type, id) => {
                  if (type === "channel") {
                    setChannelId(id);
                    navigate("chat");
                  }
                }}
                fail={fail}
              />
            )}
            {view === "members" && can("MANAGE_MEMBERS") && (
              <Members
                base={base}
                can={can}
                fail={fail}
                refresh={refresh}
              />
            )}
            {view === "friends" && (
              <Friends
                base={base}
                workspace={workspaceId}
                can={can}
                revision={revision}
                fail={fail}
                open={(id) => {
                  setChannelId(id);
                  refresh();
                  navigate("chat");
                }}
              />
            )}
            {view === "help" && <Help />}
            {view === "monitoring" && can("VIEW_MONITORING") && (
              <Monitoring
                key={base}
                base={base}
                revision={revision}
                fail={fail}
              />
            )}
            {view === "admin" && (
              <Admin
                key={`${workspaceId}/${adminTab}`}
                initialTab={adminTab}
                base={base}
                workspace={workspace}
                can={can}
                refresh={() => {
                  refresh();
                  void loadMe();
                }}
                fail={fail}
              />
            )}
            {view === "settings" && (
              <Preferences
                base={base}
                user={me!}
                reload={async () => {
                  await loadMe();
                  refresh();
                }}
                fail={fail}
              />
            )}
            {view === "notifications" && (
              <div className="page">
                <header className="page-heading">
                  <div>
                    <h1>Votre boîte de réception</h1>
                    <p>Les conversations et les signaux qui vous concernent.</p>
                  </div>
                  <span className="tag">{unread} non lues</span>
                </header>
                {!notifications.length ? (
                  <Empty title="Vous êtes à jour">
                    Les mentions, tâches attribuées et alertes apparaîtront ici.
                  </Empty>
                ) : (
                  notifications.map((n) => (
                    <article className={`notification ${n.state}`} key={n.id}>
                      <Bell size={19} />
                      <div>
                        <strong>{n.title}</strong>
                        <p>{n.body}</p>
                        <small>
                          {new Date(n.created_at).toLocaleString("fr-FR")}
                        </small>
                      </div>
                      <button
                        onClick={() =>
                          void api(`${base}/notifications/${n.id}`, "PATCH", {
                            state: n.state === "unread" ? "read" : "dismissed",
                          })
                            .then(refresh)
                            .catch(fail)
                        }
                      >
                        {n.state === "unread"
                          ? "Marquer comme lue"
                          : "Archiver"}
                      </button>
                    </article>
                  ))
                )}
              </div>
            )}
            {view === "about" && (
              <div className="page about">
                <img src="/brand/logo-dark.svg" alt="Liora" />
                <h1>
                  Un point de rencontre.
                  <br />
                  De nouvelles possibilités.
                </h1>
                <p>
                  Liora rassemble les conversations, les projets et les signaux
                  de l’écosystème LUMA.
                </p>
                <dl>
                  <dt>Version</dt>
                  <dd>{VERSION} — BETA</dd>
                  <dt>Authentification</dt>
                  <dd>Kyros SSO v4 · renouvellement automatique</dd>
                  <dt>Espace actuel</dt>
                  <dd>{workspace.name}</dd>
                </dl>
                <p className="muted">
                  Les fonctionnalités média sont différées. Les données du seed
                  sont identifiées comme démonstration.
                </p>
              </div>
            )}
          </RenderBoundary>
        </main>
      </div>
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}
      {offline && (
        <div className="offline-banner" role="alert">
          <i />
          Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
