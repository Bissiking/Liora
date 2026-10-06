// src/client/main.tsx
import { VERSION } from "../shared/version";
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
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
  House,
  Menu,
  X,
} from "lucide-react";
import "@fontsource-variable/manrope";
import "./styles/base.css";
import "./styles/components.css";
import "./themes/index.css";
import "./styles/features.css";
import "./styles/layout.css";
import "./styles/social.css";
import "./styles/channel-settings.css";
import { deviceAppearance } from "./theme-preference";
import { navigation, navigationVisible } from "./navigation";
import { QuickSwitch } from "./QuickSwitch";
import { Inbox } from "./Inbox";
import { api, ApiError, collection } from "./api";
import type { Row, Result, User, Workspace } from "./types";
import { Avatar, Empty, FormDialog, type Field } from "./ui";
import { Chat } from "./Chat";
const Projects = lazy(() =>
  import("./Projects").then((m) => ({ default: m.Projects })),
);
import { ChannelSettings } from "./ChannelSettings";
import { ContextMenuProvider } from "./ContextMenuProvider";
import { channelPermissions } from "../shared/channel-permissions";
import { AppShell } from "./AppShell";
import { PersonalMessages } from "./PersonalMessages";
import { PersonalHome } from "./PersonalHome";
import { personalViews } from "./navigation";
const Admin = lazy(() => import("./Admin").then((m) => ({ default: m.Admin })));
const Preferences = lazy(() =>
  import("./Preferences").then((m) => ({ default: m.Preferences })),
);
import { RenderBoundary } from "./RenderBoundary";
const Monitoring = lazy(() =>
  import("./Monitoring").then((m) => ({ default: m.Monitoring })),
);
import { SearchMessages } from "./Collaboration";
const Notes = lazy(() => import("./Notes").then((m) => ({ default: m.Notes })));
import { Friends, Invitation } from "./Social";
const Help = lazy(() => import("./Help").then((m) => ({ default: m.Help })));
const Calendar = lazy(() =>
  import("./Calendar").then((m) => ({ default: m.Calendar })),
);
const Reminders = lazy(() =>
  import("./Reminders").then((m) => ({ default: m.Reminders })),
);
const Favorites = lazy(() =>
  import("./Favorites").then((m) => ({ default: m.Favorites })),
);
const Members = lazy(() =>
  import("./Members").then((m) => ({ default: m.Members })),
);
import { playSound } from "./sound";
import { applyPwaUpdate } from "./pwa";
const Places = lazy(() =>
  import("./Places").then((m) => ({ default: m.Places })),
);
function App() {
  const [collapsedNavigation, setCollapsedNavigation] = useState<string[]>([]),
    [collapsingNavigation, setCollapsingNavigation] = useState(false);
  const [pwaUpdate, setPwaUpdate] = useState(false);
  useEffect(() => {
    const ready = () => setPwaUpdate(true);
    window.addEventListener("liora:update-ready", ready);
    void navigator.serviceWorker?.getRegistration().then((r) => {
      if (r?.waiting) setPwaUpdate(true);
    });
    return () => window.removeEventListener("liora:update-ready", ready);
  }, []);
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
  const [channelSettings, setChannelSettings] = useState<Row | null>(null);
  const [targetResource, setTargetResource] = useState<Row | null>(null);
  const [targetMessage, setTargetMessage] = useState("");
  const seenNotifications = useRef<Set<string> | null>(null);
  const [searchMessages, setSearchMessages] = useState(false);
  const [quickSwitch, setQuickSwitch] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [me, setMe] = useState<User | null>(null),
    [spaces, setSpaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(""),
    [status, setStatus] = useState("loading"),
    [error, setError] = useState(""),
    [view, setView] = useState(() => {
      const saved = sessionStorage.getItem("liora.view");
      return saved === "pages" ? "home" : saved || "home";
    }),
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
  useEffect(() => {
    if (!mobile && !channelsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobile(false);
        setChannelsOpen(false);
        menuTrigger.current?.focus();
      }
      if (e.key === "Tab" && !document.querySelector("dialog[open]")) {
        const controls = Array.from(
          (mobile
            ? sidebarRef.current
            : document.querySelector(".conversation-index")
          )?.querySelectorAll<HTMLElement>("button:not(:disabled),input") || [],
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    (mobile
      ? sidebarRef.current
      : document.querySelector(".conversation-index")
    )
      ?.querySelector<HTMLElement>("button")
      ?.focus();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobile, channelsOpen]);
  useEffect(() => {
    setCollapsedNavigation(
      Array.isArray(me?.preferences.collapsedNavigation)
        ? (me.preferences.collapsedNavigation as string[])
        : [],
    );
  }, [me]);
  const collapse = async (key: string) => {
    if (!me || collapsingNavigation) return;
    setCollapsingNavigation(true);
    const next = collapsedNavigation.includes(key)
      ? collapsedNavigation.filter((k) => k !== key)
      : [...collapsedNavigation, key];
    setCollapsedNavigation(next);
    try {
      await api("/api/v1/me/navigation", "PATCH", {
        collapsedNavigation: next,
      });
      setMe((current) =>
        current
          ? {
              ...current,
              preferences: {
                ...current.preferences,
                collapsedNavigation: next,
              },
            }
          : current,
      );
    } catch (e) {
      setCollapsedNavigation(collapsedNavigation);
      fail(e);
    } finally {
      setCollapsingNavigation(false);
    }
  };
  const activeWorkspace = spaces.find((w) => w.id === workspaceId);
  const workspace: Workspace = activeWorkspace || {
    id: "",
    name: "",
    description: "",
    permissions: [],
    role_name: "",
    archived: false,
  };
  const base = `/api/v1/workspaces/${workspaceId}`,
    can = (p: string) => workspace?.permissions.includes(p) || false;
  useEffect(() => {
    const open = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      const id = params.get("workspace");
      const destination = spaces.find((w) => w.id === id);
      if (params.get("view") === "notifications") {
        if (destination) setWorkspaceId(id!);
        setView("notifications");
        history.replaceState(null, "", location.pathname);
      } else if (
        params.get("view") === "projects" &&
        destination?.permissions.includes("VIEW_PROJECT")
      ) {
        setWorkspaceId(id!);
        setView("projects");
        const task = params.get("task"),
          project = params.get("project"),
          valid = (v: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);
        setTargetResource(
          valid(task) && destination.permissions.includes("VIEW_BOARD")
            ? ({ target_type: "task", target_id: task } as Row)
            : valid(project)
              ? ({ target_type: "project", target_id: project } as Row)
              : null,
        );
        history.replaceState(null, "", location.pathname);
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [spaces]);
  useEffect(() => {
    if (workspaceId && !personalViews.has(view))
      sessionStorage.setItem(`liora.workspace.${workspaceId}.view`, view);
  }, [workspaceId, view]);
  useEffect(() => {
    if (!activeWorkspace && status === "ready" && !personalViews.has(view))
      setView("home");
  }, [activeWorkspace, status, view]);
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
    if (channelId && channels.some((c) => c.id === channelId)) {
      sessionStorage.setItem("liora.channel", channelId);
      sessionStorage.setItem(
        `liora.workspace.${workspaceId}.channel`,
        channelId,
      );
    }
  }, [channelId, workspaceId, channels]);
  useEffect(() => {
    sessionStorage.setItem("liora.view", view);
  }, [view]);
  useEffect(() => {
    sessionStorage.setItem("liora.adminTab", adminTab);
  }, [adminTab]);
  useEffect(() => {
    if (!me) return;
    const prefs = me.preferences;
    const applyTheme = () => {
      document.documentElement.dataset.theme = deviceAppearance(me).theme;
    };
    applyTheme();
    window.addEventListener("storage", applyTheme);
    window.addEventListener("liora:appearance", applyTheme);
    document.documentElement.dataset.density = String(
      prefs.density || "comfortable",
    );
    document.documentElement.dataset.fontSize = String(
      prefs.fontSize || "normal",
    );
    return () => {
      window.removeEventListener("storage", applyTheme);
      window.removeEventListener("liora:appearance", applyTheme);
    };
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
      collection(`${base}/channels`),
      collection(`${base}/categories`),
      api<Result>("/api/v1/me/notifications"),
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
      if (e.key === "Escape") setMobile(false);
      if (e.repeat || e.altKey || document.querySelector("dialog[open]"))
        return;
      if (
        mod &&
        e.shiftKey &&
        e.key.toLowerCase() === "f" &&
        can("VIEW_CHANNEL")
      ) {
        e.preventDefault();
        setSearchMessages(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickSwitch(true);
        return;
      }
      if (
        (e.target as HTMLElement)?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      const routes: Record<string, string> = {
        "0": "home",
        "1": "chat",
        "2": "projects",
        "3": "calendar",
        "4": "reminders",
        "5": "favorites",
        "6": "notifications",

        ",": "settings",
        "/": "help",
      };
      const route = routes[e.key];
      if (
        mod &&
        route &&
        !(route === "projects" && !can("VIEW_PROJECT")) &&
        !(route === "chat" && !workspaceId)
      ) {
        e.preventDefault();
        navigate(route);
      }
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [workspace?.permissions]);
  useEffect(() => {
    if (
      workspace &&
      view === "monitoring" &&
      !workspace.permissions.includes("VIEW_MONITORING")
    )
      setView("home");
  }, [workspace, view]);
  useEffect(() => {
    if (
      location.hash.startsWith("#connected=dropit") ||
      location.hash.startsWith("#connected=braindump")
    ) {
      const linkedWorkspace = new URLSearchParams(location.hash.slice(1)).get(
        "workspace",
      );
      if (linkedWorkspace) setWorkspaceId(linkedWorkspace);
      setView(
        location.hash.startsWith("#connected=braindump") ? "notes" : "settings",
      );
    }
  }, []);
  useEffect(() => {
    const open = () => {
      if (location.hash.startsWith("#connected=braindump")) setView("notes");
    };
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  useEffect(() => {
    if (!me) return;
    let gone = false;
    const load = () =>
      void api<Result>("/api/v1/me/notifications")
        .then((r) => {
          if (!gone) setNotifications(r.data);
        })
        .catch(fail);
    load();
    const timer = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      gone = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [me?.id, revision]);
  const navigate = (v: string) => {
    setTargetResource(null);
    setView(v);
    setMobile(false);
    setChannelsOpen(false);
    requestAnimationFrame(() => {
      if (
        !document.querySelector("dialog[open]") &&
        !document.activeElement?.closest(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        document.getElementById("main")?.focus({ preventScroll: true });
    });
  };
  const openChannel = (id: string, sourceWorkspace?: string) => {
    if (sourceWorkspace) setWorkspaceId(sourceWorkspace);
    setChannelId(id);
    navigate("chat");
  };
  useEffect(() => {
    const open = (e: Event) => {
      const d = (e as CustomEvent).detail;
      openChannel(d.id, d.workspaceId);
      refresh();
    };
    window.addEventListener("liora:open-channel", open);
    return () => window.removeEventListener("liora:open-channel", open);
  }, []);
  const openResource = (row: Row) => {
    if (row.workspace_id) setWorkspaceId(row.workspace_id);
    if (row.target_type === "channel" || row.target_type === "message") {
      setChannelId(
        row.target_type === "channel" ? row.target_id : row.channel_id,
      );
      setTargetMessage(row.target_type === "message" ? row.target_id : "");
      navigate("chat");
    } else {
      const route = (
        {
          project: "projects",
          task: "projects",
          event: "calendar",
        } as Record<string, string>
      )[row.target_type];
      if (!route) return;
      navigate(route);
    }
    setTargetResource(row);
  };
  const createConversation = () =>
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
            openChannel(r.data.id);
          },
        }),
      )
      .catch(fail);
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
          <h1>
            Retrouvez votre équipe.
            <br />
            <em>Faites avancer la suite.</em>
          </h1>
          <p>
            Discutez, organisez vos projets et gardez vos rendez-vous en vue.
            Votre espace de travail LUMA vous attend.
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
  const channel = channels.find((c) => c.id === channelId);
  return (
    <AppShell
      user={me!}
      workspaces={spaces}
      workspace={activeWorkspace}
      view={view}
      channels={channels}
      categories={categories}
      channelId={channelId}
      unread={notifications.filter((n) => n.state === "unread").length}
      settings={setChannelSettings}
      refresh={refresh}
      fail={fail}
      rename={(kind, row) =>
        setForm({
          title: `Renommer ${row.name}`,
          fields: [{ key: "name", label: "Nom", value: row.name }],
          save: async (d) => {
            await api(`${base}/${kind}/${row.id}`, "PATCH", d);
            refresh();
          },
        })
      }
      navigate={navigate}
      can={can}
      openChannel={openChannel}
      collapsed={collapsedNavigation}
      collapse={collapse}
      openWorkspace={(id) => {
        setWorkspaceId(id);
        setChannelId(
          sessionStorage.getItem(`liora.workspace.${id}.channel`) || "",
        );
        setView(sessionStorage.getItem(`liora.workspace.${id}.view`) || "chat");
      }}
      createChannel={createChannel}
      createConversation={createConversation}
      createWorkspace={() =>
        setForm({
          title: "Créer un espace",
          fields: [
            { key: "name", label: "Nom" },
            { key: "description", label: "Description", required: false },
          ],
          save: async (d) => {
            const r = await api<{ data: Workspace }>(
              "/api/v1/workspaces",
              "POST",
              d,
            );
            await loadMe();
            setWorkspaceId(r.data.id);
            navigate("chat");
          },
        })
      }
      joinWorkspace={() =>
        setForm({
          title: "Rejoindre un espace",
          fields: [{ key: "invite", label: "Lien ou code d’invitation" }],
          save: async (d) => {
            let value = d.invite.trim();
            try {
              value =
                new URLSearchParams(new URL(value).hash.slice(1)).get(
                  "invite",
                ) || value;
            } catch {}
            sessionStorage.setItem("liora.invite", value);
            setInvite(value);
          },
        })
      }
      search={() => setSearchMessages(true)}
      quickSwitch={() => setQuickSwitch(true)}
    >
      {error && (
        <div className="error shell-error" role="alert">
          {error}
          <button onClick={() => setError("")}>Fermer</button>
        </div>
      )}
      {searchMessages && activeWorkspace && (
        <SearchMessages
          base={base}
          close={() => setSearchMessages(false)}
          open={(id, message) => {
            openChannel(id);
            setTargetMessage(message);
          }}
        />
      )}
      <Suspense
        fallback={
          <p className="padded" role="status">
            Chargement…
          </p>
        }
      >
        <RenderBoundary key={`${workspaceId}/${view}`}>
          {view === "home" && (
            <PersonalHome
              user={me!}
              notifications={notifications}
              navigate={navigate}
            />
          )}
          {view === "chat" &&
            (channel ? (
              channel.capabilities &&
              !channel.capabilities.includes("READ_MESSAGE") ? (
                <Empty title="Lecture non autorisée">
                  Vous pouvez voir ce canal, mais votre rôle ne permet pas d’en
                  lire les messages.
                </Empty>
              ) : (
                <Chat
                  key={`${base}/${channel.id}`}
                  base={base}
                  channel={channel}
                  targetMessage={targetMessage}
                  clearTarget={() => setTargetMessage("")}
                  user={me!}
                  can={(p) =>
                    p in channelPermissions
                      ? (channel.capabilities?.includes(p) ?? can(p))
                      : can(p)
                  }
                  revision={revision}
                  refresh={refresh}
                  fail={fail}
                  presence={presence}
                />
              )
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
              initialProject={
                targetResource?.target_type === "project"
                  ? targetResource.target_id
                  : ""
              }
              initialTask={
                targetResource?.target_type === "task"
                  ? targetResource.target_id
                  : ""
              }
              base={base}
              can={can}
              revision={revision}
              refresh={refresh}
              fail={fail}
            />
          )}
          {view === "calendar" && (
            <Calendar
              initialEvent={
                targetResource?.target_type === "event"
                  ? targetResource.target_id
                  : ""
              }
              userId={me!.id}
              base={base}
              can={can}
              revision={revision}
              refresh={refresh}
              fail={fail}
            />
          )}
          {view === "reminders" && (
            <Reminders
              base="/api/v1/me"
              revision={revision}
              refresh={refresh}
              fail={fail}
            />
          )}
          {view === "favorites" && (
            <Favorites
              base="/api/v1/me"
              revision={revision}
              onNavigate={openResource}
              fail={fail}
            />
          )}
          {view === "members" && can("MANAGE_MEMBERS") && (
            <Members base={base} can={can} fail={fail} refresh={refresh} />
          )}
          {view === "notes" && <Notes />}
          {view === "messages" && (
            <PersonalMessages
              userId={me!.id}
              revision={revision}
              openChannel={openChannel}
              openFriends={() => navigate("friends")}
              fail={fail}
            />
          )}
          {view === "friends" && (
            <Friends
              userId={me!.id}
              workspace={workspaceId}
              revision={revision}
              fail={fail}
            />
          )}
          {view === "places" && (
            <Suspense fallback={<p role="status">Chargement de la carte…</p>}>
              <Places />
            </Suspense>
          )}
          {view === "help" && <Help />}
          {view === "monitoring" && can("VIEW_MONITORING") && (
            <Monitoring
              key={base}
              base="/api/v1/me"
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
            <Inbox
              openChannel={openChannel}
              base="/api/v1/me"
              notifications={notifications}
              refresh={refresh}
              fail={fail}
            />
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
                Liora rassemble les conversations, les projets et les signaux de
                l’écosystème LUMA.
              </p>
              <dl>
                <dt>Version</dt>
                <dd>{VERSION} — BETA</dd>
                <dt>Authentification</dt>
                <dd>Kyros SSO v4 · renouvellement automatique</dd>
                <dt>Espace actuel</dt>
                <dd>Espace personnel</dd>
              </dl>
              <p className="muted">
                Les fonctionnalités média sont différées. Les données du seed
                sont identifiées comme démonstration.
              </p>
            </div>
          )}
        </RenderBoundary>
      </Suspense>
      {channelSettings && (
        <ChannelSettings
          base={base}
          channel={channelSettings}
          can={can}
          close={() => setChannelSettings(null)}
          refresh={refresh}
        />
      )}
      {quickSwitch && (
        <QuickSwitch
          channels={channels}
          can={can}
          navigate={navigate}
          openChannel={openChannel}
          search={() => setSearchMessages(true)}
          close={() => setQuickSwitch(false)}
        />
      )}
      {form && (
        <FormDialog
          title={form.title}
          fields={form.fields}
          onSave={form.save}
          onClose={() => setForm(null)}
        />
      )}
      {pwaUpdate && (
        <div className="pwa-update" role="status">
          Une mise à jour est prête. Enregistrez vos modifications avant de
          recharger.
          <button onClick={() => void applyPwaUpdate()}>
            Mettre à jour Liora
          </button>
        </div>
      )}
      {offline && (
        <div className="offline-banner" role="alert">
          <i />
          Vous êtes hors ligne. Certaines fonctionnalités peuvent être limitées.
        </div>
      )}
    </AppShell>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ContextMenuProvider>
      <App />
    </ContextMenuProvider>
  </React.StrictMode>,
);
